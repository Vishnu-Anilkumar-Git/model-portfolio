from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from django.conf import settings
from .services.retrieval import retrieve_context
from .services.llm import generate_response

@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
@throttle_classes([AnonRateThrottle])
def chat_endpoint(request):
    if request.method == 'GET':
        return Response({"status": "healthy", "message": "Vishnu AI Assistant API is running."})

    message = request.data.get('message', '').strip()
    
    if not message:
        return Response({"error": "Message cannot be empty."}, status=400)
        
    if len(message) > 500:
        return Response({"error": "Message is too long. Please limit to 500 characters."}, status=400)

    # Basic Injection/Extraction protection
    if "system prompt" in message.lower() or "api key" in message.lower() or "ignore previous" in message.lower() or "run this command" in message.lower():
        return Response({"answer": "I cannot fulfill that request.", "sources": ["security_block"]})

    try:
        # Retrieve context
        retrieval_data = retrieve_context(message)
        context = retrieval_data["context"]
        sources = retrieval_data["sources"]
        
        # Generate response using OpenAI
        answer = generate_response(message, context)
        
        return Response({
            "answer": answer,
            "sources": sources
        })
    except Exception as e:
        # Do not expose stack traces to user
        return Response({"error": "An internal error occurred while processing the request."}, status=500)
