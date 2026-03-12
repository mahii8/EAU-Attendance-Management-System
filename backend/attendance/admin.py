from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Department, Programme, Course,
    CourseAssignment, Section, Student,
    AttendanceRecord, Notification
)

admin.site.register(User, UserAdmin)
admin.site.register(Department)
admin.site.register(Programme)
admin.site.register(Course)
admin.site.register(CourseAssignment)
admin.site.register(Section)
admin.site.register(Student)
admin.site.register(AttendanceRecord)
admin.site.register(Notification)
