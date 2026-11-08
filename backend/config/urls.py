from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from content import views as content_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("content.urls")),
    path("api/v1/chat/", include("chatbot.urls")),
    # Same files a static host serves, generated from the database.
    path("sitemap.xml", content_views.SitemapView.as_view(), name="root-sitemap"),
    path("robots.txt", content_views.RobotsView.as_view(), name="root-robots"),
]

if settings.SERVE_MEDIA:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
