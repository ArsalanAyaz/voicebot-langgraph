"use client"; // Mark this as a Client Component

import { useState, useRef, useEffect } from "react";
import axios from "axios";

export default function Home() {
  const [userInput, setUserInput] = useState<string>("");
  const [llmResponse, setLlmResponse] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        handleSubmit(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      audioChunksRef.current = [];
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle form submission (audio)
  const handleSubmit = async (audioBlob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");

    try {
      // Send audio to backend
      const response = await axios.post("http://localhost:8000/process-audio", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        responseType: "blob", // Ensure response is treated as a Blob
      });

      // Stream LLM response
      const eventSource = new EventSource("http://localhost:8000/process-audio");
      eventSource.onmessage = (event) => {
        setLlmResponse((prev) => prev + event.data);
      };

      // Handle audio response
      const audioBlob = new Blob([response.data], { type: "audio/mp3" });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);

      // Play audio response automatically
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((error) => {
          console.error("Autoplay failed:", error);
          // Fallback: Show a play button if autoplay is blocked
          alert("Click anywhere on the page to play the audio.");
        });
      }
    } catch (error) {
      console.error("Error processing input:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle user interaction to allow autoplay
  useEffect(() => {
    const handleUserInteraction = () => {
      if (audioRef.current && audioUrl) {
        audioRef.current.play().catch((error) => {
          console.error("Autoplay failed even after user interaction:", error);
        });
      }
    };

    // Add event listener for user interaction
    window.addEventListener("click", handleUserInteraction);

    // Cleanup
    return () => {
      window.removeEventListener("click", handleUserInteraction);
    };
  }, [audioUrl]);

  return (
    <div className="min-h-screen bg-blue-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6">Voice-Powered AI Assistant</h1>
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
        {/* Voice Recording Button */}
        <div className="flex items-center justify-center mb-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-4 py-2 rounded text-white ${
              isRecording ? "bg-red-500" : "bg-blue-500"
            } hover:bg-blue-600`}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => {
            if (mediaRecorderRef.current && isRecording) {
              stopRecording();
            }
          }}
          disabled={loading || !isRecording}
          className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          {loading ? "Processing..." : "Submit"}
        </button>
      </div>

      {/* Display User Input */}
      {userInput && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-2">You Said:</h2>
          <p className="text-gray-700">{userInput}</p>
        </div>
      )}

      {/* Display AI Response */}
      {llmResponse && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-2">AI Response:</h2>
          <p className="text-gray-700">{llmResponse}</p>
        </div>
      )}

      {/* Play AI Response Audio */}
      {audioUrl && (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-2">Listen to AI Response:</h2>
          <audio ref={audioRef} controls src={audioUrl} className="w-full" />
        </div>
      )}
    </div>
  );
}