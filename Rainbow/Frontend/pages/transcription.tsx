export default function Transcription() {
  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white shadow rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Transcription Workspace</h2>
      <p className="text-gray-600 mb-6">
        Record or upload audio files, and view transcripts here.
      </p>
      <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Start Recording
      </button>
    </div>
  );
}
