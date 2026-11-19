from django.core.mail import send_mail

from workflow.models import Notification


def notify(user, message: str) -> Notification:
    notification = Notification.objects.create(recipient=user, message=message)
    send_mail(
        subject="AP Automation notification",
        message=message,
        from_email=None,
        recipient_list=[user.email],
    )
    return notification
