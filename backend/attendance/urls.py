from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),

    # Courses
    path('courses/', views.CourseListView.as_view(), name='courses'),
    path('courses/<int:course_id>/students/', views.CourseStudentsView.as_view(), name='course_students'),
    path('courses/<int:course_id>/summary/', views.AttendanceSummaryView.as_view(), name='attendance_summary'),

    # Attendance
    path('attendance/', views.AttendanceSubmitView.as_view(), name='attendance_submit'),

    # Notifications
    path('notifications/', views.NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:notification_id>/read/', views.NotificationMarkReadView.as_view(), name='notification_read'),
    # Reports
    path('reports/course/<int:course_id>/', views.CourseReportView.as_view(), name='course_report'),
    path('reports/student/<int:student_id>/', views.StudentReportView.as_view(), name='student_report'),
    path('courses/<int:course_id>/', views.CourseUpdateView.as_view(), name='course_update'),
]