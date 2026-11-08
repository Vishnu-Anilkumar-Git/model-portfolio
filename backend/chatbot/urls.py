from django.urls import path

from . import views

urlpatterns = [
    path("", views.ChatView.as_view(), name="chat"),
    path("stream/", views.ChatStreamView.as_view(), name="chat-stream"),
    path("suggestions/", views.ChatSuggestionsView.as_view(), name="chat-suggestions"),
]
