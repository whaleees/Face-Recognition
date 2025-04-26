from supabase import create_client
import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1, MTCNN
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from ast import literal_eval
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

# Initialize Supabase client
supabase_url = 'https://tndxtseqmfnmwhvzjwhf.supabase.co'
supabase_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHh0c2VxbWZubXdodnpqd2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1NzgwNDYsImV4cCI6MjA2MTE1NDA0Nn0.nKgqbly_Ppbj6NypExsgHc7tQjg6zXwYuNP6EmNSn9s'
supabase = create_client(supabase_url, supabase_key)

# Initialize face recognition models
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
mtcnn = MTCNN(device=device)
resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

def save_embedding_to_supabase(image_data, email):
    try:
        # Decode image from bytes
        image = cv2.imdecode(np.frombuffer(image_data.read(), np.uint8), cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Detect face
        face = mtcnn(image)
        if face is None:
            raise ValueError("No face detected in image!")
        
        # Generate embedding
        face_tensor = face.to(device)
        embedding = resnet(face_tensor.unsqueeze(0)).detach().cpu().numpy().flatten()

        # Save to Supabase
        data = {'email': email, 'embedding': embedding.tolist()}
        response = supabase.table('face_embeddings').insert(data).execute()
        
        # Check if there was an error in the response
        if response.error:
            return jsonify({"error": str(response.error)}), 500

        return True
    
    except Exception as e:
        print(f"Error saving embedding: {str(e)}")
        return False

@app.route('/register', methods=['POST'])
def register():
    try:
        # Get name from form data
        email = request.form.get('email')
        if not email:
            return jsonify({"error": "Email is required"}), 400

        # Get image file
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
            
        image_file = request.files['image']
        
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_file.read(), np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Detect face using MTCNN
        face = mtcnn(image)
        if face is None:
            return jsonify({"error": "No face detected in image"}), 400
            
        # Generate embedding
        face_tensor = face.to(device)
        embedding = resnet(face_tensor.unsqueeze(0)).detach().cpu().numpy().flatten().tolist()
        print('embedding:', embedding)

        # Insert into Supabase
        data = { 'email': email, 'embedding': embedding }
        response = supabase.table('face_embeddings').insert(data).execute()
        
        # Handle error if insert fails
        if 'error' in response.data:
            return jsonify({"error": f"Database error: {response.data['error']}"}), 500

        return jsonify({"success": True, "message": "Registration successful"})

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

def recognize_face(query_embedding, database, threshold=0.7):
    for email, db_embedding in database.items():
        similarity = cosine_similarity([query_embedding], [db_embedding])[0][0]
        if similarity > threshold:
            return email
    return "Unknown"


@app.route('/recognize', methods=['POST'])
def recognize():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        email = request.form.get('email')
        if not email:
            return jsonify({"error": "Email is required"}), 400
        
        response = supabase.table('face_embeddings').select('*').eq('email', email).execute()
        
        if not response.data:  # If no matching email found
            return jsonify({"error": "Email not registered"}), 400
        
        image_file = request.files['image']
        image = cv2.imdecode(np.frombuffer(image_file.read(), np.uint8), cv2.IMREAD_COLOR)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Detect face in the provided image
        face = mtcnn(image)
        if face is None:
            return jsonify({"error": "No face detected in the image"}), 400
        
        # Generate embedding for the detected face
        face_tensor = face.to(device)
        query_embedding = resnet(face_tensor.unsqueeze(0)).detach().cpu().numpy().flatten().tolist()

        # database = {entry['email']: np.array(entry['embedding']) for entry in response.data}
        database = {}
        for entry in response.data:
            emb = entry['embedding']
            if isinstance(emb, str):
                emb = literal_eval(emb)  # safely parse '[1.0, 2.0]' to [1.0, 2.0]
            database[entry['email']] = np.array(emb, dtype=np.float32)
        result = recognize_face(query_embedding, database)
        
        return jsonify({"result": result})

    except Exception as e:
        return jsonify({"error": f"Recognition error: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
