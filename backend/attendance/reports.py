import csv
from io import BytesIO
from datetime import date, timedelta
from django.http import HttpResponse
from django.db.models import Sum
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer
)
from decimal import Decimal
from .models import Student, AttendanceRecord, Course, Section


# ─────────────────────────────────────────
# HELPER — Get attendance summary for all students in a course
# ─────────────────────────────────────────
def get_course_summary(course, start_date=None, end_date=None):
    sections = Section.objects.filter(course=course)
    students = Student.objects.filter(section__in=sections)

    summary = []

    for student in students:
        filters = {
            'student': student,
            'course': course,
            'status': 'present'
        }
        if start_date:
            filters['date__gte'] = start_date
        if end_date:
            filters['date__lte'] = end_date

        attended_hours = AttendanceRecord.objects.filter(
            **filters
        ).aggregate(
            total=Sum('session_hours')
        )['total'] or Decimal('0')

        total_hours = course.total_credit_hours
        minimum = course.minimum_required_hours
        missed_hours = total_hours - attended_hours
        percentage = round(
            (attended_hours / total_hours * 100)
            if total_hours > 0 else Decimal('0'), 1
        )

        if attended_hours >= minimum + Decimal('3'):
            status = 'Safe'
        elif attended_hours >= minimum:
            status = 'Warning'
        else:
            status = 'At Risk'

        summary.append({
            'student_id': student.student_id,
            'full_name': student.full_name,
            'attended_hours': float(attended_hours),
            'missed_hours': float(missed_hours),
            'total_hours': float(total_hours),
            'percentage': float(percentage),
            'minimum_required': float(minimum),
            'status': status
        })

    return summary


# ─────────────────────────────────────────
# PDF REPORTS
# ─────────────────────────────────────────
DARK_BLUE = colors.HexColor('#1B3A6B')
MID_BLUE  = colors.HexColor('#2E75B6')
LIGHT_BLUE = colors.HexColor('#D6E4F0')
RED   = colors.HexColor('#e74c3c')
ORANGE = colors.HexColor('#f39c12')
GREEN = colors.HexColor('#27ae60')
GRAY  = colors.HexColor('#666666')


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
        "Attendance Management System",
        ParagraphStyle('sys', fontSize=8, textColor=GRAY,
                       alignment=1, spaceAfter=12)
    ))
    elements.append(Paragraph(
        title,
        ParagraphStyle('title', fontSize=18, textColor=DARK_BLUE,
                       alignment=1, spaceAfter=6, fontName='Helvetica-Bold')
    ))
    elements.append(Paragraph(
        subtitle,
        ParagraphStyle('sub', fontSize=11, textColor=MID_BLUE,
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
        f"{course.name} | Total Credit Hours: {course.total_credit_hours} | "
        f"Minimum Required: {course.minimum_required_hours} hrs",
        styles
    )

    # Table headers
    table_data = [[
        'Student ID', 'Full Name', 'Attended Hrs',
        'Missed Hrs', 'Total Hrs', 'Percentage', 'Status'
    ]]

    for row in summary:
        table_data.append([
            row['student_id'],
            row['full_name'],
            f"{row['attended_hours']} hrs",
            f"{row['missed_hours']} hrs",
            f"{row['total_hours']} hrs",
            f"{row['percentage']}%",
            row['status']
        ])

    col_widths = [80, 160, 90, 90, 80, 90, 80]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    style = TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        # Data rows
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
         [colors.white, LIGHT_BLUE]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
    ])

    # Color the status column
    for i, row in enumerate(summary, start=1):
        color = get_status_color(row['status'])
        style.add('TEXTCOLOR', (6, i), (6, i), color)
        style.add('FONTNAME', (6, i), (6, i), 'Helvetica-Bold')

    table.setStyle(style)
    elements.append(table)

    # Summary footer
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
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK_BLUE),
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
        f"{student.full_name} | ID: {student.student_id}",
        styles
    )

    table_data = [[
        'Course', 'Attended Hrs', 'Missed Hrs',
        'Percentage', 'Minimum Required', 'Status'
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
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1),
         [colors.white, LIGHT_BLUE]),
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

    # Header info
    writer.writerow(['Ethiopian Aviation University'])
    writer.writerow(['Attendance Management System'])
    writer.writerow([])
    writer.writerow([f'Course: {course.name}'])
    writer.writerow([f'Total Credit Hours: {course.total_credit_hours}'])
    writer.writerow([f'Minimum Required Hours: {course.minimum_required_hours}'])
    writer.writerow([f'Generated: {date.today().strftime("%d %B %Y")}'])
    writer.writerow([])

    # Column headers
    writer.writerow([
        'Student ID', 'Full Name', 'Attended Hours',
        'Missed Hours', 'Total Hours', 'Percentage', 'Status'
    ])

    # Data rows
    for row in summary:
        writer.writerow([
            row['student_id'],
            row['full_name'],
            row['attended_hours'],
            row['missed_hours'],
            row['total_hours'],
            f"{row['percentage']}%",
            row['status']
        ])

    # Footer
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
        'Percentage', 'Minimum Required', 'Status'
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