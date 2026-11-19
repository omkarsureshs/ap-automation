import logging

from django.core.mail import send_mail

from workflow.models import Notification

logger = logging.getLogger(__name__)


def notify(user, message: str) -> Notification:
    notification = Notification.objects.create(recipient=user, message=message)
    try:
        send_mail(
            subject="AP Automation notification",
            message=message,
            from_email=None,
            recipient_list=[user.email],
        )
    except Exception:
        logger.exception("Failed to send notification email to %s", user.email)
    return notification
