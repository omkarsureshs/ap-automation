from django.contrib import admin

from workflow.models import ApprovalRule, ApprovalStep, Notification


@admin.register(ApprovalRule)
class ApprovalRuleAdmin(admin.ModelAdmin):
    list_display = ("min_amount", "max_amount", "approver_roles", "escalation_hours", "is_active")


@admin.register(ApprovalStep)
class ApprovalStepAdmin(admin.ModelAdmin):
    list_display = ("invoice", "approver_role", "status", "assigned_at", "decided_at")
    list_filter = ("status", "approver_role")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "message", "is_read", "created_at")
