import csv
from io import BytesIO
from datetime import date, timedelta
from django.http import HttpResponse
from django.db.models import Sum, Avg
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer
)
from decimal import Decimal
from .models import Student, AttendanceRecord, Course, CourseOffering, Enrollment


# ─────────────────────────────────────────
# HELPER — Get attendance summary for all students in a course
# ─────────────────────────────────────────
def get_course_summary(course, start_date=None, end_date=None):
    # Get all students enrolled in any section that offers this course
    offering_ids = CourseOffering.objects.filter(course=course).values_list('id', flat=True)
    student_ids = AttendanceRecord.objects.filter(
        course_offering_id__in=offering_ids
    ).values_list('student_id', flat=True).distinct()
    students = Student.objects.filter(id__in=student_ids)

    summary = []

    for student in students:
        attended_filters = {
            'student': student,
            'course_offering__course': course,
            'status__in': ['present', 'late'],
        }
        if start_date:
            attended_filters['date__gte'] = start_date
        if end_date:
            attended_filters['date__lte'] = end_date

        attended_hours = AttendanceRecord.objects.filter(
            **attended_filters
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

        # 'absent' is the correct status value — not 'unexcused'
        missed_filters = {
            'student': student,
            'course_offering__course': course,
            'status__in': ['absent', 'excused'],
        }
        if start_date:
            missed_filters['date__gte'] = start_date
        if end_date:
            missed_filters['date__lte'] = end_date

        missed_hours = AttendanceRecord.objects.filter(
            **missed_filters
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

        total_hours = course.total_credit_hours
        minimum = Decimal(str(course.minimum_required_hours))

        total_recorded = attended_hours + missed_hours
        percentage = round(
            float(attended_hours / total_recorded * 100)
            if total_recorded > 0 else 100.0, 1
        )

        if percentage >= 90:
            status = 'Safe'
        elif percentage >= 85:
            status = 'Warning'
        else:
            status = 'At Risk'

        summary.append({
            'student_id': student.student_id,
            'full_name': student.full_name,
            'attended_hours': float(attended_hours),
            'missed_hours': float(missed_hours),
            'total_hours': float(total_hours),
            'percentage': percentage,
            'minimum_required': float(minimum),
            'status': status
        })

    return summary


# ─────────────────────────────────────────
# PDF REPORTS
# ─────────────────────────────────────────
DARK_GREEN = colors.HexColor('#1A4A0F')
MID_GREEN  = colors.HexColor('#2D6A1F')
LIGHT_GREEN = colors.HexColor('#E8F5E0')
RED    = colors.HexColor('#e74c3c')
ORANGE = colors.HexColor('#f39c12')
GREEN  = colors.HexColor('#27ae60')
GRAY   = colors.HexColor('#666666')
YELLOW = colors.HexColor('#F5C518')


def get_status_color(status):
    if status == 'Safe':
        return GREEN
    elif status == 'Warning':
        return ORANGE
    return RED


def build_pdf_header(elements, title, subtitle, styles):
    elements.append(Paragraph(
        "Ethiopian Aviation University",
        ParagraphStyle('uni', fontSize=10, textColor=GRAY,
                       alignment=1, spaceAfter=4)
    ))
    elements.append(Paragraph(
        "Student Attendance Management System",
        ParagraphStyle('sys', fontSize=8, textColor=GRAY,
                       alignment=1, spaceAfter=12)
    ))
    elements.append(Paragraph(
        title,
        ParagraphStyle('title', fontSize=18, textColor=DARK_GREEN,
                       alignment=1, spaceAfter=6, fontName='Helvetica-Bold')
    ))
    elements.append(Paragraph(
        subtitle,
        ParagraphStyle('sub', fontSize=11, textColor=MID_GREEN,
                       alignment=1, spaceAfter=4)
    ))
    elements.append(Paragraph(
        f"Generated: {date.today().strftime('%d %B %Y')}",
        ParagraphStyle('date', fontSize=9, textColor=GRAY,
                       alignment=1, spaceAfter=20)
    ))
    elements.append(Spacer(1, 0.2 * inch))


def generate_course_pdf(course, summary, title):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    elements = []

    build_pdf_header(
        elements,
        title,
        f"{course.name}  |  Total Credit Hours: {course.total_credit_hours}  |  "
        f"Minimum Required: {course.minimum_required_hours} hrs",
        styles
    )

    table_data = [[
        'Student ID', 'Full Name', 'Attended Hrs',
        'Missed Hrs', 'Attendance %', 'Min Required', 'Status'
    ]]

    for row in summary:
        table_data.append([
            row['student_id'],
            row['full_name'],
            f"{row['attended_hours']} hrs",
            f"{row['missed_hours']} hrs",
            f"{row['percentage']}%",
            f"{row['minimum_required']} hrs",
            row['status']
        ])

    col_widths = [80, 160, 90, 90, 90, 90, 80]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GREEN]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ])

    for i, row in enumerate(summary, start=1):
        color = get_status_color(row['status'])
        style.add('TEXTCOLOR', (6, i), (6, i), color)
        style.add('FONTNAME', (6, i), (6, i), 'Helvetica-Bold')

    table.setStyle(style)
    elements.append(table)

    elements.append(Spacer(1, 0.3 * inch))
    safe = sum(1 for r in summary if r['status'] == 'Safe')
    warning = sum(1 for r in summary if r['status'] == 'Warning')
    at_risk = sum(1 for r in summary if r['status'] == 'At Risk')

    footer_data = [[
        f"Total Students: {len(summary)}",
        f"Safe: {safe}",
        f"Warning: {warning}",
        f"At Risk: {at_risk}"
    ]]

    footer = Table(footer_data, colWidths=[150, 100, 100, 100])
    footer.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK_GREEN),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(footer)

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_student_pdf(student, course_summaries):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=50, leftMargin=50,
        topMargin=50, bottomMargin=50
    )

    styles = getSampleStyleSheet()
    elements = []

    build_pdf_header(
        elements,
        "Student Attendance Report",
        f"{student.full_name}  |  ID: {student.student_id}",
        styles
    )

    table_data = [[
        'Course', 'Attended Hrs', 'Missed Hrs',
        'Attendance %', 'Min Required', 'Status'
    ]]

    for cs in course_summaries:
        table_data.append([
            cs['course_name'],
            f"{cs['attended_hours']} hrs",
            f"{cs['missed_hours']} hrs",
            f"{cs['percentage']}%",
            f"{cs['minimum_required']} hrs",
            cs['status']
        ])

    col_widths = [140, 80, 80, 80, 100, 80]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GREEN]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ])

    for i, cs in enumerate(course_summaries, start=1):
        color = get_status_color(cs['status'])
        style.add('TEXTCOLOR', (5, i), (5, i), color)
        style.add('FONTNAME', (5, i), (5, i), 'Helvetica-Bold')

    table.setStyle(style)
    elements.append(table)
    doc.build(elements)
    buffer.seek(0)
    return buffer


# ─────────────────────────────────────────
# CSV REPORTS
# ─────────────────────────────────────────
def generate_course_csv(course, summary, filename):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(['Ethiopian Aviation University'])
    writer.writerow(['Student Attendance Management System'])
    writer.writerow([])
    writer.writerow([f'Course: {course.name}'])
    writer.writerow([f'Total Credit Hours: {course.total_credit_hours}'])
    writer.writerow([f'Minimum Required Hours: {course.minimum_required_hours}'])
    writer.writerow([f'Generated: {date.today().strftime("%d %B %Y")}'])
    writer.writerow([])
    writer.writerow([
        'Student ID', 'Full Name', 'Attended Hours',
        'Missed Hours', 'Attendance %', 'Min Required', 'Status'
    ])

    for row in summary:
        writer.writerow([
            row['student_id'],
            row['full_name'],
            row['attended_hours'],
            row['missed_hours'],
            f"{row['percentage']}%",
            row['minimum_required'],
            row['status']
        ])

    writer.writerow([])
    safe = sum(1 for r in summary if r['status'] == 'Safe')
    warning = sum(1 for r in summary if r['status'] == 'Warning')
    at_risk = sum(1 for r in summary if r['status'] == 'At Risk')
    writer.writerow(['Summary'])
    writer.writerow([f'Total Students: {len(summary)}'])
    writer.writerow([f'Safe: {safe}'])
    writer.writerow([f'Warning: {warning}'])
    writer.writerow([f'At Risk: {at_risk}'])

    return response


def generate_student_csv(student, course_summaries):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = (
        f'attachment; filename="student_{student.student_id}_report.csv"'
    )

    writer = csv.writer(response)
    writer.writerow(['Ethiopian Aviation University'])
    writer.writerow(['Student Attendance Report'])
    writer.writerow([])
    writer.writerow([f'Student: {student.full_name}'])
    writer.writerow([f'Student ID: {student.student_id}'])
    writer.writerow([f'Generated: {date.today().strftime("%d %B %Y")}'])
    writer.writerow([])
    writer.writerow([
        'Course', 'Attended Hours', 'Missed Hours',
        'Attendance %', 'Min Required', 'Status'
    ])

    for cs in course_summaries:
        writer.writerow([
            cs['course_name'],
            cs['attended_hours'],
            cs['missed_hours'],
            f"{cs['percentage']}%",
            cs['minimum_required'],
            cs['status']
        ])

    return response

# ─────────────────────────────────────────
# NEW: Summary for CourseOffering
# ─────────────────────────────────────────
def get_course_offering_summary(offering, start_date=None, end_date=None):
    enrollments = Enrollment.objects.filter(
        section=offering.section, status='active'
    ).select_related('student')
    students = [e.student for e in enrollments]
    summary = []

    for student in students:
        filters = {'student': student, 'course_offering': offering, 'status__in': ['present', 'late']}
        # 'absent' is the correct status value — not 'unexcused'
        missed_filters = {'student': student, 'course_offering': offering, 'status__in': ['absent', 'excused']}
        if start_date:
            filters['date__gte'] = start_date
            missed_filters['date__gte'] = start_date
        if end_date:
            filters['date__lte'] = end_date
            missed_filters['date__lte'] = end_date

        # Present counts fully, Late counts as 50% (policy)
        present_hours = AttendanceRecord.objects.filter(
            student=student,
            course_offering=offering,
            status='present',
            **({} if not start_date else {'date__gte': start_date}),
            **({} if not end_date else {'date__lte': end_date}),
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        late_hours = AttendanceRecord.objects.filter(
            student=student,
            course_offering=offering,
            status='late',
            **({} if not start_date else {'date__gte': start_date}),
            **({} if not end_date else {'date__lte': end_date}),
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

        attended_hours = present_hours + late_hours
        missed_qs = AttendanceRecord.objects.filter(**missed_filters)
        missed_hours = missed_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        if missed_qs.exists() and missed_hours == 0:
            # Historical records stored absent/excused with 0 hours.
            fallback = AttendanceRecord.objects.filter(**filters).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
            missed_hours = fallback * Decimal(missed_qs.count())

        total_recorded = attended_hours + missed_hours
        earned = present_hours + (late_hours * Decimal('0.5'))
        percentage = round(float(earned / total_recorded * 100) if total_recorded > 0 else 0.0, 1)
        status = 'Safe' if percentage >= 90 else ('Warning' if percentage >= 85 else 'At Risk')

        summary.append({
            'student_id': student.student_id,
            'student_pk': student.id,
            'full_name': student.full_name,
            'attended_hours': float(attended_hours),
            'missed_hours': float(missed_hours),
            'total_hours': float(offering.course.total_credit_hours),
            'percentage': percentage,
            'minimum_required': float(offering.course.minimum_required_hours),
            'status': status,
        })
    return summary


def get_offering_student_report_data(
    offering,
    start_date=None,
    end_date=None,
    student_id=None,
    warning_threshold=85.0,
    at_risk_threshold=75.0,
):
    enrollments = Enrollment.objects.filter(
        section=offering.section,
        status='active',
    ).select_related('student')

    if student_id:
        enrollments = enrollments.filter(student_id=student_id)

    rows = []
    for enrollment in enrollments:
        student = enrollment.student
        records = AttendanceRecord.objects.filter(
            student=student,
            course_offering=offering,
        )
        if start_date:
            records = records.filter(date__gte=start_date)
        if end_date:
            records = records.filter(date__lte=end_date)

        present_hours = records.filter(
            status='present'
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        late_hours = records.filter(
            status='late'
        ).aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        excused_qs = records.filter(status='excused')
        absent_qs = records.filter(status='absent')
        excused_hours = excused_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')
        absent_hours = absent_qs.aggregate(total=Sum('hours_attended'))['total'] or Decimal('0')

        if excused_qs.exists() and excused_hours == 0:
            fallback = records.filter(
                status__in=['present', 'late'],
                hours_attended__gt=0,
            ).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
            excused_hours = fallback * Decimal(excused_qs.count())
        if absent_qs.exists() and absent_hours == 0:
            fallback = records.filter(
                status__in=['present', 'late'],
                hours_attended__gt=0,
            ).aggregate(avg=Avg('hours_attended'))['avg'] or Decimal('1.0')
            absent_hours = fallback * Decimal(absent_qs.count())

        attended_hours = present_hours + late_hours
        missed_hours = excused_hours + absent_hours
        total_recorded = attended_hours + missed_hours
        earned = present_hours + (late_hours * Decimal('0.5'))
        percentage = round(float(earned / total_recorded * 100) if total_recorded > 0 else 0.0, 1)

        if percentage < at_risk_threshold:
            status = 'At Risk'
        elif percentage < warning_threshold:
            status = 'Warning'
        else:
            status = 'Safe'

        rows.append({
            'student_pk': student.id,
            'student_id': student.student_id,
            'full_name': student.full_name,
            'present_hours': float(present_hours),
            'late_hours': float(late_hours),
            'excused_hours': float(excused_hours),
            'absent_hours': float(absent_hours),
            'attended_hours': float(attended_hours),
            'missed_hours': float(missed_hours),
            'total_hours': float(offering.course.total_credit_hours),
            'percentage': percentage,
            'minimum_required': float(offering.course.minimum_required_hours),
            'status': status,
        })

    return rows


def build_offering_report_aggregates(rows):
    total_students = len(rows)
    safe_count = sum(1 for r in rows if r['status'] == 'Safe')
    warning_count = sum(1 for r in rows if r['status'] == 'Warning')
    at_risk_count = sum(1 for r in rows if r['status'] == 'At Risk')

    avg_percentage = round(
        sum(r['percentage'] for r in rows) / total_students,
        1,
    ) if total_students else 0.0

    bands = {
        '<75%': 0,
        '75-84.9%': 0,
        '85-89.9%': 0,
        '>=90%': 0,
    }
    for row in rows:
        pct = row['percentage']
        if pct < 75:
            bands['<75%'] += 1
        elif pct < 85:
            bands['75-84.9%'] += 1
        elif pct < 90:
            bands['85-89.9%'] += 1
        else:
            bands['>=90%'] += 1

    return {
        'total_students': total_students,
        'average_attendance_percentage': avg_percentage,
        'safe_count': safe_count,
        'warning_count': warning_count,
        'at_risk_count': at_risk_count,
        'risk_distribution': {
            'Safe': safe_count,
            'Warning': warning_count,
            'At Risk': at_risk_count,
        },
        'attendance_bands': bands,
    }


def generate_offering_filtered_csv(offering, rows, aggregates, filename, filter_meta):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(['Ethiopian Aviation University'])
    writer.writerow(['Student Attendance Management System'])
    writer.writerow(['By Student Attendance Report'])
    writer.writerow([])
    writer.writerow([f'Course: {offering.course.name}'])
    writer.writerow([f'Section: {offering.section.name} (Year {offering.section.year})'])
    writer.writerow([f'Generated: {date.today().strftime("%d %B %Y")}'])
    writer.writerow([f'Range Type: {filter_meta.get("report_type", "full")}'])
    writer.writerow([f'Start Date: {filter_meta.get("start_date") or "N/A"}'])
    writer.writerow([f'End Date: {filter_meta.get("end_date") or "N/A"}'])
    writer.writerow([f'Selected Student: {filter_meta.get("student_label") or "All"}'])
    writer.writerow([])
    writer.writerow([
        'Student ID',
        'Student Name',
        'Present Hours',
        'Late Hours',
        'Excused Hours',
        'Absent Hours',
        'Attended Total',
        'Attendance %',
        'Min Required Hours',
        'Risk Status',
    ])

    for row in rows:
        writer.writerow([
            row['student_id'],
            row['full_name'],
            row['present_hours'],
            row['late_hours'],
            row['excused_hours'],
            row['absent_hours'],
            row['attended_hours'],
            f"{row['percentage']}%",
            row['minimum_required'],
            row['status'],
        ])

    writer.writerow([])
    writer.writerow(['Summary'])
    writer.writerow(['Total Students', aggregates['total_students']])
    writer.writerow(['Average Attendance %', aggregates['average_attendance_percentage']])
    writer.writerow(['Safe', aggregates['safe_count']])
    writer.writerow(['Warning', aggregates['warning_count']])
    writer.writerow(['At Risk', aggregates['at_risk_count']])
    writer.writerow([])
    writer.writerow(['Graph Summary Data'])
    writer.writerow(['Band', 'Students'])
    for band, count in aggregates['attendance_bands'].items():
        writer.writerow([band, count])

    return response


def generate_summary_overview_csv(payload, filename):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)

    writer.writerow(['EAU Attendance Executive Summary'])
    writer.writerow([f"Generated: {date.today().strftime('%d %B %Y')}"])
    writer.writerow([])

    kpi = payload.get('kpis', {})
    writer.writerow(['KPI', 'Value'])
    writer.writerow(['Total Offerings', kpi.get('total_offerings', 0)])
    writer.writerow(['Total Students', kpi.get('total_students', 0)])
    writer.writerow(['Overall Average Attendance %', kpi.get('overall_average_attendance', 0)])
    writer.writerow(['Total At Risk Students', kpi.get('total_at_risk_students', 0)])
    writer.writerow(['Worst Offering', kpi.get('worst_offering_name', 'N/A')])
    writer.writerow([])

    writer.writerow(['Risk Distribution'])
    writer.writerow(['Status', 'Count'])
    for key, val in payload.get('risk_distribution', {}).items():
        writer.writerow([key, val])
    writer.writerow([])

    writer.writerow(['Attendance Trend'])
    writer.writerow(['Period', 'Average Attendance %'])
    for row in payload.get('attendance_trend', []):
        writer.writerow([row.get('period'), row.get('average_attendance')])
    writer.writerow([])

    writer.writerow(['Offering Analytics'])
    writer.writerow([
        'Offering',
        'Programme',
        'Department',
        'Students',
        'Average Attendance %',
        'At Risk',
        'Trend Delta',
    ])
    for row in payload.get('offering_analytics', []):
        writer.writerow([
            row.get('offering_label'),
            row.get('programme_name'),
            row.get('department_name'),
            row.get('student_count'),
            row.get('average_attendance'),
            row.get('at_risk_count'),
            row.get('trend_delta'),
        ])
    return response


def generate_summary_overview_pdf(payload, title="Executive Attendance Summary"):
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
    )
    elements = []
    styles = getSampleStyleSheet()
    build_pdf_header(elements, title, "Cross-offering analytics snapshot", styles)

    kpi = payload.get('kpis', {})
    kpi_table = Table([
        ['Metric', 'Value'],
        ['Total Offerings', str(kpi.get('total_offerings', 0))],
        ['Total Students', str(kpi.get('total_students', 0))],
        ['Overall Average Attendance %', f"{kpi.get('overall_average_attendance', 0)}%"],
        ['Total At Risk Students', str(kpi.get('total_at_risk_students', 0))],
        ['Worst Offering', kpi.get('worst_offering_name', 'N/A')],
    ], colWidths=[220, 420])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GREEN]),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 14))

    offerings = payload.get('offering_analytics', [])[:10]
    offering_data = [['Offering', 'Students', 'Avg %', 'At Risk', 'Trend']]
    for row in offerings:
        offering_data.append([
            row.get('offering_label'),
            row.get('student_count'),
            f"{row.get('average_attendance', 0)}%",
            row.get('at_risk_count'),
            row.get('trend_delta'),
        ])
    offering_table = Table(offering_data, colWidths=[300, 90, 90, 90, 90], repeatRows=1)
    offering_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_GREEN),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_GREEN]),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    elements.append(Paragraph("Top Offerings Snapshot", styles['Heading3']))
    elements.append(offering_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer