from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Sum
from decimal import Decimal
from django.http import HttpResponse
from datetime import date, timedelta
from .models import (
    User, Course, CourseAssignment, Section,
    Student, AttendanceRecord, Notification
)
from .serializers import (
    UserSerializer, LoginSerializer, CourseSerializer,
    StudentSerializer, AttendanceRecordSerializer,
    AttendanceSubmitSerializer, NotificationSerializer,
    StudentAttendanceSummarySerializer
)
from .utils import send_absence_alert, send_threshold_warning
from .reports import (
    get_course_summary, generate_course_pdf,
    generate_course_csv, generate_student_pdf,
    generate_student_csv
)


# ─────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {'error': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─────────────────────────────────────────
# COURSE VIEWS
# ─────────────────────────────────────────
class CourseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'admin':
            courses = Course.objects.all()
        else:
            assigned = CourseAssignment.objects.filter(
                teacher=user
            ).values_list('course_id', flat=True)
            courses = Course.objects.filter(id__in=assigned)
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)


class CourseStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        sections = Section.objects.filter(course=course)
        students = Student.objects.filter(section__in=sections)
        serializer = StudentSerializer(students, many=True)
        return Response({
            'course': CourseSerializer(course).data,
            'students': serializer.data
        })


# ─────────────────────────────────────────
# ATTENDANCE VIEWS
# ─────────────────────────────────────────
class AttendanceSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttendanceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        course_id        = data['course_id']
        attendance_date  = data['date']
        session_type     = data['session_type']
        session_hours    = data['session_hours']
        records          = data['records']

        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        created_records = []

        for record in records:
            student_id = record.get('student_id')
            status_val = record.get('status')

            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                continue

            att_record, created = AttendanceRecord.objects.update_or_create(
                student=student,
                course=course,
                date=attendance_date,
                session_type=session_type,
                defaults={
                    'status': status_val,
                    'session_hours': session_hours if status_val == 'present' else 0,
                    'recorded_by': request.user
                }
            )

            created_records.append(att_record)

            if status_val == 'absent':
                self.handle_absence(
                    student, course, attendance_date, request.user
                )

        return Response({
            'message': f'Attendance recorded for {len(created_records)} students',
            'date': str(attendance_date),
            'course': course.name
        }, status=status.HTTP_201_CREATED)

    def handle_absence(self, student, course, attendance_date, teacher):
        message = (
            f"{student.full_name} was marked absent in "
            f"{course.name} on {attendance_date}."
        )

        Notification.objects.create(
            recipient=teacher,
            notification_type='absence',
            message=message
        )

        send_absence_alert(student, course, attendance_date)
        self.check_threshold(student, course, teacher)

    def check_threshold(self, student, course, teacher):
        attended = AttendanceRecord.objects.filter(
            student=student,
            course=course,
            status='present'
        ).aggregate(
            total=Sum('session_hours')
        )['total'] or Decimal('0')

        minimum = course.minimum_required_hours

        if attended < minimum + Decimal('3'):
            message = (
                f"WARNING: {student.full_name} has only attended "
                f"{attended} hours in {course.name}. "
                f"Minimum required: {minimum} hours."
            )

            Notification.objects.create(
                recipient=teacher,
                notification_type='threshold',
                message=message
            )

            send_threshold_warning(student, course, attended, minimum)


class AttendanceSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        sections = Section.objects.filter(course=course)
        students = Student.objects.filter(section__in=sections)
        summary = []

        for student in students:
            attended_hours = AttendanceRecord.objects.filter(
                student=student,
                course=course,
                status='present'
            ).aggregate(
                total=Sum('session_hours')
            )['total'] or Decimal('0')

            total_hours = course.total_credit_hours
            missed_hours = total_hours - attended_hours
            minimum = course.minimum_required_hours

            if attended_hours >= minimum + Decimal('3'):
                student_status = 'safe'
            elif attended_hours >= minimum:
                student_status = 'warning'
            else:
                student_status = 'at_risk'

            percentage = (
                (attended_hours / total_hours * 100)
                if total_hours > 0 else Decimal('0')
            )

            summary.append({
                'student': StudentSerializer(student).data,
                'total_hours': total_hours,
                'attended_hours': attended_hours,
                'missed_hours': missed_hours,
                'attendance_percentage': round(percentage, 1),
                'minimum_required_hours': minimum,
                'status': student_status
            })

        return Response({
            'course': CourseSerializer(course).data,
            'summary': summary
        })


# ─────────────────────────────────────────
# NOTIFICATION VIEWS
# ─────────────────────────────────────────
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        notifications = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        )
        serializer = NotificationSerializer(notifications, many=True)
        return Response({
            'count': notifications.count(),
            'notifications': serializer.data
        })


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient=request.user
            )
            notification.is_read = True
            notification.save()
            return Response({'message': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )


# ─────────────────────────────────────────
# REPORT VIEWS
# ─────────────────────────────────────────
class CourseReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        report_format = request.query_params.get('format', 'pdf')
        report_type = request.query_params.get('type', 'full')

        if report_type == 'weekly':
            end_date = date.today()
            start_date = end_date - timedelta(days=7)
            summary = get_course_summary(course, start_date, end_date)
            title = "Weekly Attendance Report"
            filename = f"{course.name}_weekly_{end_date}"
        else:
            summary = get_course_summary(course)
            title = "Full Attendance Report"
            filename = f"{course.name}_full_report"

        if report_format == 'csv':
            return generate_course_csv(course, summary, f"{filename}.csv")

        buffer = generate_course_pdf(course, summary, title)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="{filename}.pdf"'
        )
        return response


class StudentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response(
                {'error': 'Student not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        report_format = request.query_params.get('format', 'pdf')

        course_ids = AttendanceRecord.objects.filter(
            student=student
        ).values_list('course_id', flat=True).distinct()

        course_summaries = []

        for course_id in course_ids:
            course = Course.objects.get(id=course_id)
            attended_hours = AttendanceRecord.objects.filter(
                student=student,
                course=course,
                status='present'
            ).aggregate(
                total=Sum('session_hours')
            )['total'] or Decimal('0')

            total_hours = course.total_credit_hours
            minimum = course.minimum_required_hours
            missed_hours = total_hours - attended_hours
            percentage = round(
                float(attended_hours) / float(total_hours) * 100
                if total_hours > 0 else 0, 1
            )

            if attended_hours >= minimum + Decimal('3'):
                st = 'Safe'
            elif attended_hours >= minimum:
                st = 'Warning'
            else:
                st = 'At Risk'

            course_summaries.append({
                'course_name': course.name,
                'attended_hours': float(attended_hours),
                'missed_hours': float(missed_hours),
                'total_hours': float(total_hours),
                'percentage': percentage,
                'minimum_required': float(minimum),
                'status': st
            })

        if report_format == 'csv':
            return generate_student_csv(student, course_summaries)

        buffer = generate_student_pdf(student, course_summaries)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="student_{student.student_id}_report.pdf"'
        )
        return response
class CourseUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response(
                {'error': 'Course not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        name = request.data.get('name', course.name)
        total_credit_hours = request.data.get('total_credit_hours', course.total_credit_hours)
        course.name = name
        course.total_credit_hours = total_credit_hours
        course.save()
        return Response(CourseSerializer(course).data)