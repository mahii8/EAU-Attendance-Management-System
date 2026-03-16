from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view()),
    path('auth/me/', views.MeView.as_view()),

    # Programmes & Sections
    path('programmes/', views.ProgrammeListView.as_view()),
    path('sections/', views.SectionListView.as_view()),

    # Courses
    path('courses/', views.CourseListView.as_view()),
    path('courses/<int:course_id>/', views.CourseUpdateView.as_view()),
    path('courses/<int:course_id>/students/', views.CourseStudentsView.as_view()),
    path('courses/<int:course_id>/summary/', views.AttendanceSummaryView.as_view()),

    # Attendance
    path('attendance/', views.AttendanceListView.as_view()),
    path('attendance/submit/', views.AttendanceSubmitView.as_view()),

    # Students
    path('students/', views.StudentListView.as_view()),
    path('students/<int:student_id>/', views.StudentUpdateView.as_view()),

    # Users
    path('users/', views.UserListView.as_view()),
    path('users/<int:user_id>/', views.UserUpdateView.as_view()),

    # Notifications
    path('notifications/', views.NotificationListView.as_view()),
    path('notifications/<int:notification_id>/read/', views.NotificationMarkReadView.as_view()),

    # Settings
    path('settings/', views.SystemSettingsView.as_view()),

    # Reports
    path('reports/course/<int:course_id>/', views.CourseReportView.as_view()),
    path('reports/student/<int:student_id>/', views.StudentReportView.as_view()),
]