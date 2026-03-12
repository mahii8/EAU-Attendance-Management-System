from rest_framework import serializers
from .models import (
    User, Department, Programme, Course,
    CourseAssignment, Section, Student,
    AttendanceRecord, Notification
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role']


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'


class ProgrammeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programme
        fields = '__all__'


class CourseSerializer(serializers.ModelSerializer):
    minimum_required_hours = serializers.ReadOnlyField()
    programme_name = serializers.CharField(
        source='programme.name',
        read_only=True
    )

    class Meta:
        model = Course
        fields = [
            'id', 'name', 'total_credit_hours',
            'minimum_required_hours', 'programme',
            'programme_name'
        ]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = '__all__'


class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    section_name = serializers.CharField(
        source='section.name',
        read_only=True
    )

    class Meta:
        model = Student
        fields = [
            'id', 'first_name', 'last_name', 'full_name',
            'student_id', 'email', 'parent_email',
            'section', 'section_name'
        ]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(
        source='student.full_name',
        read_only=True
    )
    student_id_number = serializers.CharField(
        source='student.student_id',
        read_only=True
    )

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'student', 'student_name', 'student_id_number',
            'course', 'date', 'status', 'session_type',
            'session_hours', 'recorded_by'
        ]
        read_only_fields = ['recorded_by']


class AttendanceSubmitSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()
    date = serializers.DateField()
    session_type = serializers.ChoiceField(
        choices=['theory', 'practical']
    )
    session_hours = serializers.DecimalField(
        max_digits=4,
        decimal_places=1
    )
    records = serializers.ListField(
        child=serializers.DictField()
    )


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class StudentAttendanceSummarySerializer(serializers.Serializer):
    student = StudentSerializer()
    total_hours = serializers.DecimalField(max_digits=6, decimal_places=1)
    attended_hours = serializers.DecimalField(max_digits=6, decimal_places=1)
    missed_hours = serializers.DecimalField(max_digits=6, decimal_places=1)
    attendance_percentage = serializers.DecimalField(
        max_digits=5,
        decimal_places=1
    )
    minimum_required_hours = serializers.DecimalField(
        max_digits=5,
        decimal_places=1
    )
    status = serializers.CharField()