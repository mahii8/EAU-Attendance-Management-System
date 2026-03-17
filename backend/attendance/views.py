from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.db.models import Sum
from decimal import Decimal
from django.http import HttpResponse
from datetime import date, timedelta
import datetime

from .models import (
    User, Course, CourseAssignment, Section,
    Student, AttendanceRecord, Notification,
    Programme, Department, SystemSettings
)
from .serializers import (
    UserSerializer, LoginSerializer, CourseSerializer,
    StudentSerializer, AttendanceRecordSerializer,
    AttendanceSubmitSerializer, NotificationSerializer,
    StudentAttendanceSummarySerializer, SystemSettingsSerializer,
    ProgrammeSerializer, SectionSerializer
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
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)
        if not user:
            return Response(
                {'error': 'Invalid username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user_data = UserSerializer(user).data
        if not user.has_logged_in_before:
            user.has_logged_in_before = True
            user.save(update_fields=['has_logged_in_before'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': user_data
        })


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─────────────────────────────────────────
# PROGRAMME VIEWS
# ─────────────────────────────────────────
class ProgrammeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        programmes = Programme.objects.all()
        return Response(ProgrammeSerializer(programmes, many=True).data)


# ─────────────────────────────────────────
# SECTION VIEWS
# ─────────────────────────────────────────
class SectionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        programme_id = request.query_params.get('programme')
        year = request.query_params.get('year')
        semester = request.query_params.get('semester')
        academic_year = request.query_params.get('academic_year')

        sections = Section.objects.all()
        if programme_id:
            sections = sections.filter(programme_id=programme_id)
        if year:
            sections = sections.filter(year=year)
        if semester:
            sections = sections.filter(semester=semester)
        if academic_year:
            sections = sections.filter(academic_year=academic_year)

        return Response(SectionSerializer(sections, many=True).data)


# ─────────────────────────────────────────
# COURSE VIEWS
# ─────────────────────────────────────────
class CourseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        programme_id = request.query_params.get('programme')
        year = request.query_params.get('year')
        semester = request.query_params.get('semester')
        section_id = request.query_params.get('section')

        if user.role == 'admin' or user.is_superuser:
            courses = Course.objects.all()
            if programme_id:
                courses = courses.filter(programme_id=programme_id)
            if year:
                courses = courses.filter(year=year)
            if semester:
                courses = courses.filter(semester=semester)
        else:
            assignments = CourseAssignment.objects.filter(teacher=user)
            if section_id:
                assignments = assignments.filter(section_id=section_id)
            courses = Course.objects.filter(
                id__in=assignments.values_list('course_id', flat=True)
            ).distinct()
            if programme_id:
                courses = courses.filter(programme_id=programme_id)
            if year:
                courses = courses.filter(year=year)
            if semester:
                courses = courses.filter(semester=semester)

        return Response(CourseSerializer(courses, many=True).data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        code = request.data.get('code', '')
        total_credit_hours = request.data.get('total_credit_hours')
        programme_id = request.data.get('programme_id')
        year = request.data.get('year', 1)
        semester = request.data.get('semester', 1)

        if not all([name, total_credit_hours, programme_id]):
            return Response(
                {'error': 'name, total_credit_hours and programme_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            programme = Programme.objects.get(id=programme_id)
        except Programme.DoesNotExist:
            return Response({'error': 'Programme not found'}, status=status.HTTP_404_NOT_FOUND)

        course = Course.objects.create(
            name=name,
            code=code,
            total_credit_hours=total_credit_hours,
            programme=programme,
            year=year,
            semester=semester
        )
        return Response(CourseSerializer(course).data, status=status.HTTP_201_CREATED)


class CourseUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            from decimal import Decimal
            course.name = request.data.get('name', course.name)
            course.code = request.data.get('code', course.code)
            total_credit_hours = request.data.get('total_credit_hours', course.total_credit_hours)
            course.total_credit_hours = Decimal(str(total_credit_hours))
            course.year = int(request.data.get('year', course.year))
            course.semester = int(request.data.get('semester', course.semester))
            course.save()
            return Response(CourseSerializer(course).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    


class CourseStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        section_id = request.query_params.get('section')
        assignments = CourseAssignment.objects.filter(course=course)
        if section_id:
            assignments = assignments.filter(section_id=section_id)

        section_ids = assignments.values_list('section_id', flat=True)
        students = Student.objects.filter(section_id__in=section_ids).distinct()

        return Response({
            'course': CourseSerializer(course).data,
            'students': StudentSerializer(students, many=True).data
        })


# ─────────────────────────────────────────
# ATTENDANCE SUMMARY
# ─────────────────────────────────────────
class AttendanceSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        section_id = request.query_params.get('section')
        assignments = CourseAssignment.objects.filter(course=course)
        if section_id:
            assignments = assignments.filter(section_id=section_id)

        section_ids = assignments.values_list('section_id', flat=True)
        students = Student.objects.filter(section_id__in=section_ids).distinct()
        summary = []

        for student in students:
            records = AttendanceRecord.objects.filter(student=student, course=course)
            attended_hours = records.filter(
                status__in=['present', 'late']
            ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

            total_hours = course.total_credit_hours
            missed_hours = records.filter(
                status__in=['absent', 'exempted']
            ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

            minimum = course.minimum_required_hours
            total = attended_hours + missed_hours
            percentage = (attended_hours / total * 100) if total > 0 else Decimal('100')

            if percentage < Decimal('85'):
                student_status = 'at_risk'
            elif percentage < Decimal('90'):
                student_status = 'warning'
            else:
                student_status = 'safe'

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
# ATTENDANCE VIEWS
# ─────────────────────────────────────────
class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        course_id = request.query_params.get('course')
        date_str = request.query_params.get('date')
        section_id = request.query_params.get('section')
        programme_id = request.query_params.get('programme')
        year = request.query_params.get('year')
        search = request.query_params.get('search', '')

        records = AttendanceRecord.objects.select_related(
            'student', 'course', 'student__section'
        ).order_by('-date')

        if course_id:
            records = records.filter(course_id=course_id)
        if date_str:
            try:
                filter_date = datetime.date.fromisoformat(date_str)
                records = records.filter(date=filter_date)
            except ValueError:
                pass
        if section_id:
            records = records.filter(student__section_id=section_id)
        if programme_id:
            records = records.filter(student__section__programme_id=programme_id)
        if year:
            records = records.filter(student__section__year=year)
        if search:
            records = records.filter(
                student__first_name__icontains=search
            ) | records.filter(
                student__last_name__icontains=search
            ) | records.filter(
                student__student_id__icontains=search
            )

        data = []
        for r in records:
            data.append({
                'id': r.id,
                'date': r.date,
                'student_name': r.student.full_name,
                'student_id': r.student.student_id,
                'course_name': r.course.name,
                'section_name': r.student.section.name,
                'status': r.status,
                'hours_attended': r.hours_attended,
            })
        return Response(data)


class AttendanceSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttendanceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        course_id = data['course_id']
        section_id = data['section_id']
        attendance_date = data['date']
        session_type = data['session_type']
        session_hours = data['session_hours']
        records = data['records']

        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

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
                    'hours_attended': session_hours if status_val in ['present', 'late'] else 0,
                    'recorded_by': request.user
                }
            )
            created_records.append(att_record)

            if status_val in ['absent']:
                self.handle_absence(student, course, attendance_date, request.user)

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
            status__in=['present', 'late']
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

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


# ─────────────────────────────────────────
# STUDENT VIEWS
# ─────────────────────────────────────────
class StudentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        section_id = request.query_params.get('section')
        programme_id = request.query_params.get('programme')
        year = request.query_params.get('year')
        search = request.query_params.get('search', '')

        students = Student.objects.select_related('section__programme').all()

        if section_id:
            students = students.filter(section_id=section_id)
        if programme_id:
            students = students.filter(section__programme_id=programme_id)
        if year:
            students = students.filter(section__year=year)
        if search:
            students = students.filter(
                first_name__icontains=search
            ) | students.filter(
                last_name__icontains=search
            ) | students.filter(
                student_id__icontains=search
            )

        return Response(StudentSerializer(students, many=True).data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        required = ['first_name', 'last_name', 'student_id', 'email', 'section_id']
        for field in required:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            section = Section.objects.get(id=request.data['section_id'])
        except Section.DoesNotExist:
            return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)

        student = Student.objects.create(
            first_name=request.data['first_name'],
            last_name=request.data['last_name'],
            student_id=request.data['student_id'],
            email=request.data['email'],
            parent_email=request.data.get('parent_email', ''),
            parent_telegram=request.data.get('parent_telegram', ''),
            section=section
        )
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class StudentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

        for field in ['first_name', 'last_name', 'email', 'parent_email', 'parent_telegram']:
            if field in request.data:
                setattr(student, field, request.data[field])

        if 'section_id' in request.data:
            try:
                section = Section.objects.get(id=request.data['section_id'])
                student.section = section
            except Section.DoesNotExist:
                return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)

        student.save()
        return Response(StudentSerializer(student).data)

    def delete(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
            student.delete()
            return Response({'message': 'Student deleted'})
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# USER VIEWS
# ─────────────────────────────────────────
class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        required = ['username', 'first_name', 'last_name', 'email', 'role', 'password']
        for field in required:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if User.objects.filter(username=request.data['username']).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create(
            username=request.data['username'],
            first_name=request.data['first_name'],
            last_name=request.data['last_name'],
            email=request.data['email'],
            role=request.data['role'],
            password=make_password(request.data['password'])
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        for field in ['first_name', 'last_name', 'email', 'role']:
            if field in request.data:
                setattr(user, field, request.data[field])

        if 'password' in request.data and request.data['password']:
            user.password = make_password(request.data['password'])

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, user_id):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(id=user_id)
            if user.is_superuser:
                return Response(
                    {'error': 'Cannot delete superuser'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.delete()
            return Response({'message': 'User deleted'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


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
        return Response({
            'count': notifications.count(),
            'notifications': NotificationSerializer(notifications, many=True).data
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
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SETTINGS VIEWS
# ─────────────────────────────────────────
class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        s = SystemSettings.get()
        return Response(SystemSettingsSerializer(s).data)

    def patch(self, request):
        if request.user.role != 'admin' and not request.user.is_superuser:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        s = SystemSettings.get()
        serializer = SystemSettingsSerializer(s, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────
# REPORT VIEWS
# ─────────────────────────────────────────
class DownloadReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        course_id = request.query_params.get('course_id')
        student_id = request.query_params.get('student_id')
        summary = request.query_params.get('summary')
        
        report_format = request.query_params.get('format', 'pdf')
        report_type = request.query_params.get('type', 'full')

        if course_id:
            try:
                course = Course.objects.get(id=course_id)
            except Course.DoesNotExist:
                return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

            if report_type == 'weekly':
                end_date = date.today()
                start_date = end_date - timedelta(days=7)
                report_summary = get_course_summary(course, start_date, end_date)
                title = "Weekly Attendance Report"
                filename = f"{course.name}_weekly_{end_date}"
            else:
                report_summary = get_course_summary(course)
                title = "Full Attendance Report"
                filename = f"{course.name}_full_report"

            if report_format == 'csv':
                return generate_course_csv(course, report_summary, f"{filename}.csv")

            buffer = generate_course_pdf(course, report_summary, title)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
            return response

        elif student_id:
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

            course_ids = AttendanceRecord.objects.filter(
                student=student
            ).values_list('course_id', flat=True).distinct()

            course_summaries = []
            for cid in course_ids:
                course = Course.objects.get(id=cid)
                attended_hours = AttendanceRecord.objects.filter(
                    student=student,
                    course=course,
                    status__in=['present', 'late']
                ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

                total_hours = course.total_credit_hours
                minimum = course.minimum_required_hours
                missed_hours = AttendanceRecord.objects.filter(
                    student=student,
                    course=course,
                    status__in=['absent', 'exempted']
                ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

                percentage = round(
                    float(attended_hours) / float(total_hours) * 100
                    if total_hours > 0 else 0, 1
                )

                if percentage >= 90:
                    st = 'Safe'
                elif percentage >= 85:
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
            response['Content-Disposition'] = f'attachment; filename="student_{student.student_id}_report.pdf"'
            return response

        elif summary == 'true':
            # Optionally implement logic for an all-courses summary report if needed
            return Response({'error': 'Overall summary report not implemented yet.'}, status=status.HTTP_501_NOT_IMPLEMENTED)
            
        return Response({'error': 'Missing valid filter (course_id, student_id, summary)'}, status=status.HTTP_400_BAD_REQUEST)


class CourseTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        months = int(request.query_params.get('months', 3))
        end_date = date.today()
        start_date = end_date - timedelta(days=30 * months)

        records = AttendanceRecord.objects.filter(
            course=course,
            status__in=['present', 'late', 'absent', 'exempted'],
            date__gte=start_date,
            date__lte=end_date
        ).order_by('date')

        weekly_data = {}
        for r in records:
            week_start = r.date - timedelta(days=r.date.weekday())
            week_label = f"Week of {week_start.strftime('%b %d')}"
            
            if week_label not in weekly_data:
                weekly_data[week_label] = {'attended': Decimal('0'), 'total': Decimal('0')}

            if r.status in ['present', 'late']:
                weekly_data[week_label]['attended'] += r.hours_attended
            weekly_data[week_label]['total'] += r.hours_attended

        trend = []
        for label, data in weekly_data.items():
            percentage = round(
                float(data['attended']) / float(data['total']) * 100
                if data['total'] > 0 else 0, 1
            )
            trend.append({
                'name': label,
                'percentage': percentage
            })

        return Response(trend)
class CourseReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, course_id):
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

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
        response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
        return response


class StudentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)

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
                status__in=['present', 'late']
            ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

            total_hours = course.total_credit_hours
            minimum = course.minimum_required_hours
            missed_hours = AttendanceRecord.objects.filter(
                student=student,
                course=course,
                status__in=['absent', 'exempted']
            ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

            percentage = round(
                float(attended_hours) / float(total_hours) * 100
                if total_hours > 0 else 0, 1
            )

            if percentage >= 90:
                st = 'Safe'
            elif percentage >= 85:
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
        response['Content-Disposition'] = f'attachment; filename="student_{student.student_id}_report.pdf"'
        return response


# ─────────────────────────────────────────
# PORTAL DASHBOARDS
# ─────────────────────────────────────────
class StudentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not hasattr(user, 'student_profile'):
            return Response({'error': 'No student profile found for this user.'}, status=status.HTTP_404_NOT_FOUND)

        student = user.student_profile
        records = AttendanceRecord.objects.filter(student=student)
        
        # Total overall attendance %
        total_records = records.count()
        attended = records.filter(status__in=['present', 'late']).count()
        overall_percentage = round((attended / total_records * 100) if total_records > 0 else 100.0, 1)

        # Enrolled courses stats
        course_ids = records.values_list('course_id', flat=True).distinct()
        enrolled_courses_count = course_ids.count()
        is_at_risk = False
        course_breakdown = []

        for cid in course_ids:
            course = Course.objects.get(id=cid)
            course_recs = records.filter(course_id=cid)
            absent_hours = course_recs.filter(status='absent').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
            absence_rate = round(float(absent_hours) / float(course.total_credit_hours) * 100 if course.total_credit_hours > 0 else 0, 1)
            if absence_rate >= 15.0:
                is_at_risk = True
            
            course_breakdown.append({
                'course_name': course.name,
                'course_code': course.code,
                'total_credit_hours': float(course.total_credit_hours),
                'absent_hours': float(absent_hours),
                'absence_rate': absence_rate,
                'is_critical': absence_rate >= 15.0
            })
        
        # Recent attendance history
        recent_records = records.order_by('-date')[:15]
        history = []
        for r in recent_records:
            history.append({
                'date': r.date.strftime("%b %d, %Y"),
                'course_name': r.course.name,
                'status': r.get_status_display()
            })

        return Response({
            'student': {
                'id': student.id,
                'full_name': student.full_name,
                'student_id': student.student_id,
                'email': student.email
            },
            'metrics': {
                'overall_percentage': overall_percentage,
                'enrolled_courses': enrolled_courses_count,
                'is_at_risk': is_at_risk
            },
            'course_breakdown': course_breakdown,
            'history': history
        })


class ParentDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        children = user.children.all()
        if not children.exists():
            return Response({'error': 'No linked students found for this parent account.'}, status=status.HTTP_404_NOT_FOUND)

        # Build data array for each child
        children_data = []

        for student in children:
            records = AttendanceRecord.objects.filter(student=student)
            total_records = records.count()
            attended = records.filter(status__in=['present', 'late']).count()
            overall_percentage = round((attended / total_records * 100) if total_records > 0 else 100.0, 1)

            course_ids = records.values_list('course_id', flat=True).distinct()
            is_at_risk = False
            course_breakdown = []

            for cid in course_ids:
                course = Course.objects.get(id=cid)
                course_recs = records.filter(course_id=cid)
                absent_hours = course_recs.filter(status='absent').aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                absence_rate = round(float(absent_hours) / float(course.total_credit_hours) * 100 if course.total_credit_hours > 0 else 0, 1)
                if absence_rate >= 15.0:
                    is_at_risk = True
                
                course_breakdown.append({
                    'course_name': course.name,
                    'course_code': course.code,
                    'total_credit_hours': float(course.total_credit_hours),
                    'absent_hours': float(absent_hours),
                    'absence_rate': absence_rate,
                    'is_critical': absence_rate >= 15.0
                })

            recent_records = records.order_by('-date')[:15]
            history = []
            for r in recent_records:
                history.append({
                    'date': r.date.strftime("%b %d, %Y"),
                    'course_name': r.course.name,
                    'status': r.get_status_display()
                })

            children_data.append({
                'student': {
                    'id': student.id,
                    'full_name': student.full_name,
                    'student_id': student.student_id,
                    'email': student.email
                },
                'metrics': {
                    'overall_percentage': overall_percentage,
                    'enrolled_courses': len(course_ids),
                    'total_records': total_records,
                    'is_at_risk': is_at_risk
                },
                'course_breakdown': course_breakdown,
                'history': history,
            })

        return Response({'children': children_data})