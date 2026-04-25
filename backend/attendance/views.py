import csv
import io
from decimal import Decimal
from datetime import date, timedelta
import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import make_password
from django.db.models import Sum, Q
from django.http import HttpResponse

from .models import (
    User, Programme, Course, AcademicYear, Semester,
    Section, Student, Enrollment, CourseOffering,
    AttendanceRecord, Notification, SystemSettings, School
)
from .serializers import (
    UserSerializer, LoginSerializer, ProgrammeSerializer,
    CourseSerializer, AcademicYearSerializer, SemesterSerializer,
    SectionSerializer, StudentSerializer, EnrollmentSerializer,
    CourseOfferingSerializer, AttendanceRecordSerializer,
    AttendanceSubmitSerializer, NotificationSerializer,
    SystemSettingsSerializer, SchoolSerializer
)
from .utils import send_absence_alert, send_threshold_warning
from .reports import (
    get_course_offering_summary, generate_course_pdf,
    generate_course_csv, generate_student_pdf, generate_student_csv
)


# ─────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────
def is_admin(user):
    return user.role == 'admin' or user.is_superuser


def is_elevated(user):
    return user.role in ('admin', 'dean', 'dept_head') or user.is_superuser


def get_programme_ids(user):
    """
    Returns list of programme IDs accessible to the user.
    Returns None for unrestricted (admin/superuser).
    Returns [] if no scope assigned (teacher etc.).
    """
    if user.role == 'admin' or user.is_superuser:
        return None
    if user.role == 'dept_head' and user.managed_programme_id:
        return [user.managed_programme_id]
    if user.role == 'dean' and user.managed_school_id:
        return list(
            Programme.objects.filter(
                school_id=user.managed_school_id, is_active=True
            ).values_list('id', flat=True)
        )
    return []


def apply_programme_scope(qs, user, programme_field='programme_id'):
    """Filter queryset to programmes the user can access."""
    ids = get_programme_ids(user)
    if ids is None:
        return qs
    if not ids:
        return qs.none()
    return qs.filter(**{f'{programme_field}__in': ids})


def notify_elevated(notification_type, message, programme=None):
    """Notify all elevated users. Tags notification with programme for scoped filtering."""
    recipients = User.objects.filter(
        Q(role='admin') | Q(is_superuser=True) |
        Q(role='dept_head', managed_programme=programme) |
        Q(role='dean', managed_school__programmes=programme)
    ).distinct()
    for u in recipients:
        Notification.objects.create(
            recipient=u,
            notification_type=notification_type,
            message=message,
            programme=programme,
        )


# ─────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('username') or request.data.get('staff_id') or request.data.get('email')
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'error': 'Credentials required'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=identifier, password=password)
        if not user:
            try:
                found = User.objects.get(staff_id=identifier)
                user = authenticate(username=found.username, password=password)
            except User.DoesNotExist:
                pass
        if not user:
            try:
                found = User.objects.get(email=identifier)
                user = authenticate(username=found.username, password=password)
            except User.DoesNotExist:
                pass

        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        refresh['user_id'] = int(user.id)
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
# PROGRAMMES
# ─────────────────────────────────────────
class ProgrammeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        programmes = Programme.objects.all()
        programmes = apply_programme_scope(programmes, request.user, 'id')
        if request.query_params.get('active_only'):
            programmes = programmes.filter(is_active=True)
        return Response(ProgrammeSerializer(programmes, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        programme = Programme.objects.create(
            name=name,
            code=request.data.get('code', ''),
            duration_years=request.data.get('duration_years', 4),
        )
        return Response(ProgrammeSerializer(programme).data, status=status.HTTP_201_CREATED)


class ProgrammeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, programme_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            programme = Programme.objects.get(id=programme_id)
        except Programme.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'duration_years', 'is_active']:
            if field in request.data:
                setattr(programme, field, request.data[field])
        programme.save()
        return Response(ProgrammeSerializer(programme).data)

    def delete(self, request, programme_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            programme = Programme.objects.get(id=programme_id)
            programme.is_active = False
            programme.save()
            return Response({'message': 'Programme deactivated'})
        except Programme.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# COURSES
# ─────────────────────────────────────────
class CourseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        courses = Course.objects.select_related('programme').all()
        courses = apply_programme_scope(courses, request.user, 'programme_id')
        if request.query_params.get('programme'):
            courses = courses.filter(programme_id=request.query_params['programme'])
        if request.query_params.get('year'):
            courses = courses.filter(year=request.query_params['year'])
        if request.query_params.get('active_only'):
            courses = courses.filter(is_active=True)
        return Response(CourseSerializer(courses, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'total_credit_hours', 'programme_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            programme = Programme.objects.get(id=request.data['programme_id'])
        except Programme.DoesNotExist:
            return Response({'error': 'Programme not found'}, status=status.HTTP_404_NOT_FOUND)
        course = Course.objects.create(
            name=request.data['name'],
            code=request.data.get('code', ''),
            programme=programme,
            year=request.data.get('year', 1),
            total_credit_hours=request.data['total_credit_hours'],
            minimum_attendance_percent=request.data.get('minimum_attendance_percent', 85.0),
        )
        return Response(CourseSerializer(course).data, status=status.HTTP_201_CREATED)


class CourseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, course_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'year', 'total_credit_hours', 'minimum_attendance_percent', 'is_active']:
            if field in request.data:
                setattr(course, field, request.data[field])
        course.save()
        return Response(CourseSerializer(course).data)

    def delete(self, request, course_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            course = Course.objects.get(id=course_id)
            course.is_active = False
            course.save()
            return Response({'message': 'Course deactivated'})
        except Course.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# ACADEMIC YEARS
# ─────────────────────────────────────────
class AcademicYearListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        years = AcademicYear.objects.all()
        return Response(AcademicYearSerializer(years, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'start_date', 'end_date']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        year = AcademicYear.objects.create(
            name=request.data['name'],
            start_date=request.data['start_date'],
            end_date=request.data['end_date'],
            is_current=request.data.get('is_current', False),
        )
        return Response(AcademicYearSerializer(year).data, status=status.HTTP_201_CREATED)


class AcademicYearDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, year_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            year = AcademicYear.objects.get(id=year_id)
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'start_date', 'end_date', 'is_current']:
            if field in request.data:
                setattr(year, field, request.data[field])
        year.save()
        return Response(AcademicYearSerializer(year).data)

    def delete(self, request, year_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            year = AcademicYear.objects.get(id=year_id)
            year.delete()
            return Response({'message': 'Academic year deleted'})
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SEMESTERS
# ─────────────────────────────────────────
class SemesterListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semesters = Semester.objects.select_related('academic_year').all()
        if request.query_params.get('academic_year'):
            semesters = semesters.filter(academic_year_id=request.query_params['academic_year'])
        if request.query_params.get('current'):
            semesters = semesters.filter(is_current=True)
        return Response(SemesterSerializer(semesters, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['academic_year_id', 'number', 'start_date', 'end_date']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            academic_year = AcademicYear.objects.get(id=request.data['academic_year_id'])
        except AcademicYear.DoesNotExist:
            return Response({'error': 'Academic year not found'}, status=status.HTTP_404_NOT_FOUND)
        semester = Semester.objects.create(
            academic_year=academic_year,
            number=request.data['number'],
            start_date=request.data['start_date'],
            end_date=request.data['end_date'],
            is_current=request.data.get('is_current', False),
        )
        return Response(SemesterSerializer(semester).data, status=status.HTTP_201_CREATED)


class SemesterDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, semester_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            semester = Semester.objects.get(id=semester_id)
        except Semester.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['number', 'start_date', 'end_date', 'is_current']:
            if field in request.data:
                setattr(semester, field, request.data[field])
        semester.save()
        return Response(SemesterSerializer(semester).data)

    def delete(self, request, semester_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            semester = Semester.objects.get(id=semester_id)
            semester.delete()
            return Response({'message': 'Semester deleted'})
        except Semester.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SECTIONS
# ─────────────────────────────────────────
class SectionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sections = Section.objects.select_related('programme', 'semester__academic_year').all()
        sections = apply_programme_scope(sections, request.user, 'programme_id')
        if request.query_params.get('semester'):
            sections = sections.filter(semester_id=request.query_params['semester'])
        if request.query_params.get('programme'):
            sections = sections.filter(programme_id=request.query_params['programme'])
        if request.query_params.get('year'):
            sections = sections.filter(year=request.query_params['year'])
        return Response(SectionSerializer(sections, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['name', 'programme_id', 'year', 'semester_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            programme = Programme.objects.get(id=request.data['programme_id'])
            semester = Semester.objects.get(id=request.data['semester_id'])
        except (Programme.DoesNotExist, Semester.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        section, created = Section.objects.get_or_create(
            name=request.data['name'],
            programme=programme,
            year=request.data['year'],
            semester=semester,
        )
        return Response(SectionSerializer(section).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class SectionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, section_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            section = Section.objects.get(id=section_id)
        except Section.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'year']:
            if field in request.data:
                setattr(section, field, request.data[field])
        section.save()
        return Response(SectionSerializer(section).data)

    def delete(self, request, section_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            section = Section.objects.get(id=section_id)
            section.delete()
            return Response({'message': 'Section deleted'})
        except Section.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# STUDENTS
# ─────────────────────────────────────────
class StudentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        students = Student.objects.select_related('programme').all()
        students = apply_programme_scope(students, request.user, 'programme_id')
        if request.query_params.get('programme'):
            students = students.filter(programme_id=request.query_params['programme'])
        if request.query_params.get('active_only'):
            students = students.filter(is_active=True)
        if request.query_params.get('semester'):
            students = students.filter(
                enrollments__section__semester_id=request.query_params['semester'],
                enrollments__status='active'
            ).distinct()
        if request.query_params.get('section'):
            students = students.filter(
                enrollments__section_id=request.query_params['section'],
                enrollments__status='active'
            ).distinct()
        if request.query_params.get('search'):
            q = request.query_params['search']
            students = students.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) |
                Q(student_id__icontains=q) | Q(email__icontains=q)
            )
        return Response(StudentSerializer(students, many=True).data)

    def post(self, request):
        if not is_elevated(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['first_name', 'last_name', 'student_id', 'email']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        if Student.objects.filter(student_id=request.data['student_id']).exists():
            return Response({'error': 'Student ID already exists'}, status=status.HTTP_400_BAD_REQUEST)
        programme = None
        if request.data.get('programme_id'):
            try:
                programme = Programme.objects.get(id=request.data['programme_id'])
            except Programme.DoesNotExist:
                return Response({'error': 'Programme not found'}, status=status.HTTP_404_NOT_FOUND)
        student = Student.objects.create(
            first_name=request.data['first_name'],
            last_name=request.data['last_name'],
            student_id=request.data['student_id'],
            email=request.data['email'],
            parent_email=request.data.get('parent_email', ''),
            parent_telegram=request.data.get('parent_telegram', ''),
            programme=programme,
        )
        if request.data.get('section_id'):
            try:
                section = Section.objects.get(id=request.data['section_id'])
                Enrollment.objects.create(student=student, section=section)
            except Section.DoesNotExist:
                pass
        return Response(StudentSerializer(student).data, status=status.HTTP_201_CREATED)


class StudentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['first_name', 'last_name', 'email', 'parent_email', 'parent_telegram', 'is_active']:
            if field in request.data:
                setattr(student, field, request.data[field])
        student.save()
        return Response(StudentSerializer(student).data)

    def delete(self, request, student_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            student = Student.objects.get(id=student_id)
            student.is_active = False
            student.save()
            return Response({'message': 'Student deactivated'})
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class StudentBulkImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'CSV file is required'}, status=status.HTTP_400_BAD_REQUEST)
        decoded = file.read().decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))
        created, updated, errors = [], [], []
        for i, row in enumerate(reader, start=2):
            try:
                student_id = row.get('student_id', '').strip()
                if not student_id:
                    errors.append({'row': i, 'error': 'student_id is required'})
                    continue
                programme = None
                if row.get('programme_code', '').strip():
                    programme = Programme.objects.filter(code__iexact=row['programme_code'].strip()).first()
                student, was_created = Student.objects.update_or_create(
                    student_id=student_id,
                    defaults={
                        'first_name': row.get('first_name', '').strip(),
                        'last_name': row.get('last_name', '').strip(),
                        'email': row.get('email', '').strip(),
                        'parent_email': row.get('parent_email', '').strip(),
                        'parent_telegram': row.get('parent_telegram', '').strip(),
                        'programme': programme,
                        'is_active': True,
                    }
                )
                if row.get('section_id', '').strip():
                    try:
                        section = Section.objects.get(id=int(row['section_id'].strip()))
                        Enrollment.objects.get_or_create(student=student, section=section, defaults={'status': 'active'})
                    except (Section.DoesNotExist, ValueError):
                        pass
                if was_created:
                    created.append(student_id)
                else:
                    updated.append(student_id)
            except Exception as e:
                errors.append({'row': i, 'error': str(e)})
        return Response({
            'created': len(created), 'updated': len(updated), 'errors': errors,
            'message': f'{len(created)} students created, {len(updated)} updated, {len(errors)} errors'
        }, status=status.HTTP_200_OK)


# ─────────────────────────────────────────
# ENROLLMENTS
# ─────────────────────────────────────────
class EnrollmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        enrollments = Enrollment.objects.select_related(
            'student', 'section__programme', 'section__semester__academic_year'
        ).all()
        enrollments = apply_programme_scope(enrollments, request.user, 'section__programme_id')
        if request.query_params.get('section'):
            enrollments = enrollments.filter(section_id=request.query_params['section'])
        if request.query_params.get('student'):
            enrollments = enrollments.filter(student_id=request.query_params['student'])
        if request.query_params.get('semester'):
            enrollments = enrollments.filter(section__semester_id=request.query_params['semester'])
        if request.query_params.get('status'):
            enrollments = enrollments.filter(status=request.query_params['status'])
        return Response(EnrollmentSerializer(enrollments, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            student = Student.objects.get(id=request.data['student_id'])
            section = Section.objects.get(id=request.data['section_id'])
        except (Student.DoesNotExist, Section.DoesNotExist, KeyError) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        enrollment, created = Enrollment.objects.get_or_create(
            student=student, section=section, defaults={'status': 'active'}
        )
        return Response(EnrollmentSerializer(enrollment).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class EnrollmentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, enrollment_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id)
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if 'status' in request.data:
            enrollment.status = request.data['status']
            enrollment.save()
        return Response(EnrollmentSerializer(enrollment).data)

    def delete(self, request, enrollment_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            enrollment = Enrollment.objects.get(id=enrollment_id)
            enrollment.delete()
            return Response({'message': 'Enrollment removed'})
        except Enrollment.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class BulkEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        section_id = request.data.get('section_id')
        student_ids = request.data.get('student_ids', [])
        if not section_id or not student_ids:
            return Response({'error': 'section_id and student_ids are required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            section = Section.objects.get(id=section_id)
        except Section.DoesNotExist:
            return Response({'error': 'Section not found'}, status=status.HTTP_404_NOT_FOUND)
        enrolled, skipped = 0, 0
        for sid in student_ids:
            try:
                student = Student.objects.get(id=sid)
                _, created = Enrollment.objects.get_or_create(
                    student=student, section=section, defaults={'status': 'active'}
                )
                enrolled += 1 if created else 0
                skipped += 0 if created else 1
            except Student.DoesNotExist:
                skipped += 1
        return Response({'enrolled': enrolled, 'skipped': skipped})


# ─────────────────────────────────────────
# COURSE OFFERINGS
# ─────────────────────────────────────────
class CourseOfferingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        offerings = CourseOffering.objects.select_related(
            'course__programme', 'section__programme',
            'section__semester__academic_year', 'teacher'
        ).all()

        # Teachers only see their own offerings; elevated users (including superusers)
        # can see everything within their scope.
        if user.role == 'teacher' and not is_elevated(user):
            offerings = offerings.filter(teacher=user)
        else:
            offerings = apply_programme_scope(offerings, user, 'section__programme_id')

        if request.query_params.get('semester'):
            offerings = offerings.filter(section__semester_id=request.query_params['semester'])
        if request.query_params.get('section'):
            offerings = offerings.filter(section_id=request.query_params['section'])
        if request.query_params.get('programme'):
            offerings = offerings.filter(section__programme_id=request.query_params['programme'])
        if request.query_params.get('teacher'):
            offerings = offerings.filter(teacher_id=request.query_params['teacher'])
        return Response(CourseOfferingSerializer(offerings, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['course_id', 'section_id']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            course = Course.objects.get(id=request.data['course_id'])
            section = Section.objects.get(id=request.data['section_id'])
        except (Course.DoesNotExist, Section.DoesNotExist) as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        teacher = None
        if request.data.get('teacher_id'):
            try:
                teacher = User.objects.get(id=request.data['teacher_id'])
            except User.DoesNotExist:
                return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)
        offering, created = CourseOffering.objects.get_or_create(
            course=course, section=section, defaults={'teacher': teacher}
        )
        if not created and teacher:
            offering.teacher = teacher
            offering.save()
        return Response(CourseOfferingSerializer(offering).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CourseOfferingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, offering_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if 'teacher_id' in request.data:
            try:
                offering.teacher = User.objects.get(id=request.data['teacher_id'])
            except User.DoesNotExist:
                return Response({'error': 'Teacher not found'}, status=status.HTTP_404_NOT_FOUND)
        offering.save()
        return Response(CourseOfferingSerializer(offering).data)

    def delete(self, request, offering_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            offering = CourseOffering.objects.get(id=offering_id)
            offering.delete()
            return Response({'message': 'Course offering removed'})
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


class CourseOfferingStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        enrollments = Enrollment.objects.filter(section=offering.section, status='active').select_related('student')
        students = [e.student for e in enrollments]
        return Response({
            'offering': CourseOfferingSerializer(offering).data,
            'students': StudentSerializer(students, many=True).data
        })


class CourseOfferingSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        settings = SystemSettings.get()
        at_risk_threshold = settings.at_risk_threshold
        warning_threshold = settings.warning_threshold
        enrollments = Enrollment.objects.filter(section=offering.section, status='active').select_related('student')
        summary = []
        for enrollment in enrollments:
            student = enrollment.student
            records = AttendanceRecord.objects.filter(student=student, course_offering=offering)
            attended = records.filter(status__in=['present', 'late']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
            missed = records.filter(status__in=['absent', 'excused']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
            total = attended + missed
            percentage = round(float(attended / total * 100) if total > 0 else 100.0, 1)
            if percentage < float(at_risk_threshold):
                stu_status = 'at_risk'
            elif percentage < float(warning_threshold):
                stu_status = 'warning'
            else:
                stu_status = 'safe'
            summary.append({
                'student': StudentSerializer(student).data,
                'attended_hours': float(attended),
                'missed_hours': float(missed),
                'total_hours': float(offering.course.total_credit_hours),
                'attendance_percentage': percentage,
                'minimum_required_hours': float(offering.course.minimum_required_hours),
                'status': stu_status,
            })
        return Response({'offering': CourseOfferingSerializer(offering).data, 'summary': summary})


# ─────────────────────────────────────────
# ATTENDANCE
# ─────────────────────────────────────────
class AttendanceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        records = AttendanceRecord.objects.select_related(
            'student', 'course_offering__course', 'course_offering__section'
        ).order_by('-date')
        records = apply_programme_scope(records, request.user, 'course_offering__section__programme_id')
        if request.query_params.get('offering'):
            records = records.filter(course_offering_id=request.query_params['offering'])
        if request.query_params.get('section'):
            records = records.filter(course_offering__section_id=request.query_params['section'])
        if request.query_params.get('semester'):
            records = records.filter(course_offering__section__semester_id=request.query_params['semester'])
        if request.query_params.get('programme'):
            records = records.filter(course_offering__section__programme_id=request.query_params['programme'])
        if request.query_params.get('student'):
            records = records.filter(student_id=request.query_params['student'])
        if request.query_params.get('student_staff_id'):
            records = records.filter(student__student_id=request.query_params['student_staff_id'])
        if request.query_params.get('date'):
            try:
                records = records.filter(date=datetime.date.fromisoformat(request.query_params['date']))
            except ValueError:
                pass
        if request.query_params.get('search'):
            q = request.query_params['search']
            records = records.filter(
                Q(student__first_name__icontains=q) | Q(student__last_name__icontains=q) |
                Q(student__student_id__icontains=q)
            )
        data = [{
            'id': r.id, 'date': r.date,
            'student_name': r.student.full_name, 'student_id': r.student.student_id,
            'course_name': r.course_offering.course.name,
            'section_name': r.course_offering.section.name,
            'status': r.status, 'hours_attended': r.hours_attended,
        } for r in records]
        return Response(data)


class AttendanceSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AttendanceSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            offering = CourseOffering.objects.get(id=data['course_offering_id'])
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Course offering not found'}, status=status.HTTP_404_NOT_FOUND)

        teacher = request.user
        teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username
        absent_students = []
        count = 0

        for record in data['records']:
            student_id = record.get('student_id')
            status_val = record.get('status')
            try:
                student = Student.objects.get(id=student_id)
            except Student.DoesNotExist:
                continue
            AttendanceRecord.objects.update_or_create(
                student=student, course_offering=offering,
                date=data['date'], session_type=data['session_type'],
                defaults={
                    'status': status_val,
                    'hours_attended': data['session_hours'] if status_val in ['present', 'late'] else Decimal('0'),
                    'recorded_by': teacher,
                }
            )
            count += 1
            if status_val == 'absent':
                absent_students.append(student.full_name)
                self._handle_absence(student, offering, data['date'], teacher)

        section_label = f"Sec {offering.section.name} Y{offering.section.year}"
        absent_count = len(absent_students)
        teacher_msg = (
            f"You logged attendance for {offering.course.name} ({section_label}) on {data['date']}. "
            f"{count} students recorded" + (f", {absent_count} absent." if absent_count else ".")
        )
        Notification.objects.create(recipient=teacher, notification_type='info', message=teacher_msg)
        admin_msg = (
            f"{teacher_name} logged attendance for {offering.course.name} ({section_label}) on {data['date']}. "
            f"{count} students recorded" + (
                f", {absent_count} absent: {', '.join(absent_students[:5])}" +
                (" and more." if absent_count > 5 else ".") if absent_count else "."
            )
        )
        notify_elevated('info', admin_msg, programme=offering.course.programme)
        return Response({
            'message': f'Attendance recorded for {count} students',
            'date': str(data['date']), 'course': offering.course.name,
        }, status=status.HTTP_201_CREATED)

    def _handle_absence(self, student, offering, att_date, teacher):
        teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username
        Notification.objects.create(
            recipient=teacher, notification_type='absence',
            message=f"{student.full_name} was absent in {offering.course.name} on {att_date}."
        )
        notify_elevated(
            'absence',
            f"{student.full_name} (ID: {student.student_id}) was absent in "
            f"{offering.course.name} on {att_date}. Logged by {teacher_name}.",
            programme=offering.course.programme,
        )
        try:
            send_absence_alert(student, offering.course, att_date)
        except Exception:
            pass
        self._check_threshold(student, offering, teacher)

    def _check_threshold(self, student, offering, teacher):
        settings_obj = SystemSettings.get()
        at_risk_threshold = float(settings_obj.at_risk_threshold)
        warning_threshold = float(settings_obj.warning_threshold)
        teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username
        records = AttendanceRecord.objects.filter(student=student, course_offering=offering)
        attended = records.filter(status__in=['present', 'late']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        missed = records.filter(status__in=['absent', 'excused']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        total = attended + missed
        if total == 0:
            return
        percentage = round(float(attended / total * 100), 1)
        minimum = offering.course.minimum_required_hours
        if percentage < at_risk_threshold:
            level, notif_type = "AT RISK", 'at_risk'
        elif percentage < warning_threshold:
            level, notif_type = "WARNING", 'threshold'
        else:
            return
        message = (
            f"{level}: {student.full_name} (ID: {student.student_id}) attendance in "
            f"{offering.course.name} is now {percentage}% ({float(attended)} hrs attended). "
            f"Minimum required: {float(minimum)} hrs."
        )
        Notification.objects.create(recipient=teacher, notification_type=notif_type, message=message)
        notify_elevated(notif_type, f"{message} Logged by {teacher_name}.", programme=offering.course.programme)
        try:
            send_threshold_warning(student, offering.course, attended, minimum)
        except Exception:
            pass


# ─────────────────────────────────────────
# AT-RISK
# ─────────────────────────────────────────
class AtRiskView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = SystemSettings.get()
        at_risk_threshold = float(settings.at_risk_threshold)
        semester_id = request.query_params.get('semester')
        programme_id = request.query_params.get('programme')
        offerings = CourseOffering.objects.select_related('course', 'section__semester', 'section__programme').all()
        offerings = apply_programme_scope(offerings, request.user, 'section__programme_id')
        if semester_id:
            offerings = offerings.filter(section__semester_id=semester_id)
        if programme_id:
            offerings = offerings.filter(section__programme_id=programme_id)
        at_risk = []
        for offering in offerings:
            enrollments = Enrollment.objects.filter(section=offering.section, status='active').select_related('student')
            for e in enrollments:
                student = e.student
                records = AttendanceRecord.objects.filter(student=student, course_offering=offering)
                attended = records.filter(status__in=['present', 'late']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                missed = records.filter(status__in=['absent', 'excused']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                total = attended + missed
                if total == 0:
                    continue
                percentage = round(float(attended / total * 100), 1)
                if percentage < at_risk_threshold:
                    at_risk.append({
                        'student_id': student.student_id, 'student_name': student.full_name,
                        'course_name': offering.course.name, 'section': offering.section.name,
                        'programme': offering.section.programme.name,
                        'attended_hours': float(attended), 'missed_hours': float(missed),
                        'attendance_percentage': percentage,
                        'minimum_required': float(offering.course.minimum_required_hours),
                    })
        return Response({'count': len(at_risk), 'students': at_risk})


# ─────────────────────────────────────────
# STATS
# ─────────────────────────────────────────
class StatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        semester_id = request.query_params.get('semester')
        current_semester = None
        if semester_id:
            try:
                current_semester = Semester.objects.get(id=semester_id)
            except Semester.DoesNotExist:
                pass
        else:
            current_semester = Semester.objects.filter(is_current=True).first()

        programme_ids = get_programme_ids(user)

        def scope(qs, field):
            if programme_ids is None:
                return qs
            if not programme_ids:
                return qs.none()
            return qs.filter(**{f'{field}__in': programme_ids})

        total_students   = scope(Student.objects.filter(is_active=True), 'programme_id').count()
        total_courses    = scope(Course.objects.filter(is_active=True), 'programme_id').count()
        total_programmes = scope(Programme.objects.filter(is_active=True), 'id').count()
        active_enrollments = 0
        status_counts = {'present': 0, 'late': 0, 'excused': 0, 'absent': 0}

        if current_semester:
            enroll_qs = scope(
                Enrollment.objects.filter(section__semester=current_semester, status='active'),
                'section__programme_id'
            )
            active_enrollments = enroll_qs.count()
            records = scope(
                AttendanceRecord.objects.filter(course_offering__section__semester=current_semester),
                'course_offering__section__programme_id'
            )
            for s in status_counts:
                status_counts[s] = records.filter(status=s).count()

        return Response({
            'total_students': total_students, 'total_courses': total_courses,
            'total_programmes': total_programmes, 'active_enrollments': active_enrollments,
            'current_semester': SemesterSerializer(current_semester).data if current_semester else None,
            'status_distribution': status_counts,
        })


# ─────────────────────────────────────────
# USERS
# ─────────────────────────────────────────
class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all()
        if request.query_params.get('role'):
            users = users.filter(role=request.query_params['role'])
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        required = ['email', 'role', 'password']
        for f in required:
            if not request.data.get(f):
                return Response({'error': f'{f} is required'}, status=status.HTTP_400_BAD_REQUEST)
        username = request.data.get('username') or request.data.get('staff_id') or request.data['email']
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        managed_programme = None
        managed_school = None
        if request.data.get('managed_programme_id'):
            try:
                managed_programme = Programme.objects.get(id=request.data['managed_programme_id'])
            except Programme.DoesNotExist:
                return Response({'error': 'Programme not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.data.get('managed_school_id'):
            try:
                managed_school = School.objects.get(id=request.data['managed_school_id'])
            except School.DoesNotExist:
                return Response({'error': 'School not found'}, status=status.HTTP_404_NOT_FOUND)
        user = User.objects.create(
            username=username,
            staff_id=request.data.get('staff_id', ''),
            first_name=request.data.get('first_name', ''),
            last_name=request.data.get('last_name', ''),
            email=request.data['email'],
            role=request.data['role'],
            password=make_password(request.data['password']),
            managed_programme=managed_programme,
            managed_school=managed_school,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['first_name', 'last_name', 'email', 'role', 'staff_id']:
            if field in request.data:
                setattr(user, field, request.data[field])
        if request.data.get('password'):
            user.password = make_password(request.data['password'])
        if 'managed_programme_id' in request.data:
            pid = request.data['managed_programme_id']
            user.managed_programme = Programme.objects.filter(id=pid).first() if pid else None
        if 'managed_school_id' in request.data:
            sid = request.data['managed_school_id']
            user.managed_school = School.objects.filter(id=sid).first() if sid else None
        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, user_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = User.objects.get(id=user_id)
            if user.is_superuser:
                return Response({'error': 'Cannot delete superuser'}, status=status.HTTP_400_BAD_REQUEST)
            user.delete()
            return Response({'message': 'User deleted'})
        except User.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────
class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        programme_ids = get_programme_ids(user)
        if programme_ids is None:
            notifications = Notification.objects.filter(
                Q(recipient=user) | Q(recipient__isnull=True), is_read=False
            ).order_by('-created_at')
        else:
            notifications = Notification.objects.filter(
                Q(recipient=user) | Q(programme_id__in=programme_ids), is_read=False
            ).order_by('-created_at')
        return Response({'count': notifications.count(), 'notifications': NotificationSerializer(notifications, many=True).data})


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        user = request.user
        programme_ids = get_programme_ids(user)
        try:
            if programme_ids is None:
                n = Notification.objects.get(Q(recipient=user) | Q(recipient__isnull=True), id=notification_id)
            else:
                n = Notification.objects.get(Q(recipient=user) | Q(programme_id__in=programme_ids), id=notification_id)
            n.is_read = True
            n.save()
            return Response({'message': 'Marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# ─────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────
class SystemSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SystemSettingsSerializer(SystemSettings.get()).data)

    def patch(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        s = SystemSettings.get()
        serializer = SystemSettingsSerializer(s, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────
# REPORTS
# ─────────────────────────────────────────
class CourseOfferingReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offering_id):
        try:
            offering = CourseOffering.objects.get(id=offering_id)
        except CourseOffering.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report_format = request.query_params.get('report_format', 'pdf')
        report_type = request.query_params.get('type', 'full')
        try:
            # Build a meaningful filename: CourseName_SecA_Y2_weekly_2026-04-25
            course_slug = offering.course.name.replace(' ', '_')
            section_slug = f"Sec{offering.section.name.replace(' ', '')}_Y{offering.section.year}"

            if report_type == 'weekly':
                end_date = date.today()
                start_date = end_date - timedelta(days=7)
                summary = get_course_offering_summary(offering, start_date, end_date)
                title = "Weekly Attendance Report"
                filename = f"{course_slug}_{section_slug}_Weekly_Report_{end_date}"
            else:
                summary = get_course_offering_summary(offering)
                title = "Full Attendance Report"
                filename = f"{course_slug}_{section_slug}_Full_Report"
            if report_format == 'csv':
                return generate_course_csv(offering.course, summary, f"{filename}.csv")
            buffer = generate_course_pdf(offering.course, summary, title)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
            return response
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Report generation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudentReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, student_id):
        try:
            student = Student.objects.get(id=student_id)
        except Student.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report_format = request.query_params.get('report_format', 'pdf')
        semester_id = request.query_params.get('semester')
        try:
            records_qs = AttendanceRecord.objects.filter(student=student)
            if semester_id:
                records_qs = records_qs.filter(course_offering__section__semester_id=semester_id)
            offering_ids = records_qs.values_list('course_offering_id', flat=True).distinct()
            course_summaries = []
            for oid in offering_ids:
                offering = CourseOffering.objects.get(id=oid)
                attended = records_qs.filter(course_offering=offering, status__in=['present', 'late']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                missed = records_qs.filter(course_offering=offering, status__in=['absent', 'excused']).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
                total = offering.course.total_credit_hours
                percentage = round(float(attended) / float(total) * 100 if total > 0 else 0, 1)
                course_summaries.append({
                    'course_name': offering.course.name,
                    'attended_hours': float(attended), 'missed_hours': float(missed),
                    'total_hours': float(total), 'percentage': percentage,
                    'minimum_required': float(offering.course.minimum_required_hours),
                    'status': 'Safe' if percentage >= 90 else ('Warning' if percentage >= 85 else 'At Risk'),
                })
            if report_format == 'csv':
                return generate_student_csv(student, course_summaries)
            buffer = generate_student_pdf(student, course_summaries)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="student_{student.student_id}_report.pdf"'
            return response
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({'error': f'Report generation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────
# SCHOOLS
# ─────────────────────────────────────────
class SchoolListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        schools = School.objects.all()
        if request.query_params.get('active_only'):
            schools = schools.filter(is_active=True)
        return Response(SchoolSerializer(schools, many=True).data)

    def post(self, request):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        name = request.data.get('name')
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)
        school = School.objects.create(name=name, code=request.data.get('code', ''))
        return Response(SchoolSerializer(school).data, status=status.HTTP_201_CREATED)


class SchoolDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, school_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            school = School.objects.get(id=school_id)
        except School.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        for field in ['name', 'code', 'is_active']:
            if field in request.data:
                setattr(school, field, request.data[field])
        school.save()
        return Response(SchoolSerializer(school).data)

    def delete(self, request, school_id):
        if not is_admin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            school = School.objects.get(id=school_id)
            school.is_active = False
            school.save()
            return Response({'message': 'School deactivated'})
        except School.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)