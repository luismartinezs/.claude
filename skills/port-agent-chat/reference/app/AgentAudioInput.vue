<script setup lang="ts">
import { ref } from 'vue';
import { recordingFileName } from './lib/attachments.ts';

// A microphone button that produces text.
//
// The recording is transcribed and the TEXT is what the agent sees: neither CLI takes audio. The
// transcription call is the app's own (a dedicated speech recogniser through whichever plain model
// API the app already uses), which is why it arrives here as a prop rather than being imported.
const props = defineProps<{
  /** Returns the transcript, or throws with something worth showing the operator. */
  transcribe: (recording: File) => Promise<string>;
}>();
const emit = defineEmits<{ transcript: [text: string] }>();

const recorder = ref<MediaRecorder | null>(null);
const recording = ref(false);
const working = ref(false);
const error = ref('');

const toggle = async (): Promise<void> => {
  if (recording.value) {
    recorder.value?.stop();
    return;
  }
  error.value = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    media.ondataavailable = event => chunks.push(event.data);
    media.onstop = async () => {
      // EVERY TRACK STOPPED. Leaving one open keeps the browser's recording indicator on, which
      // reads to the operator as the app still listening.
      stream.getTracks().forEach(track => track.stop());
      recording.value = false;
      const type = media.mimeType || 'audio/webm';
      const file = new File(chunks, recordingFileName(type), { type });
      working.value = true;
      try {
        const text = (await props.transcribe(file)).trim();
        if (text) emit('transcript', text);
        else error.value = 'Nothing was said, or it could not be heard.';
      } catch (failure) {
        error.value = failure instanceof Error ? failure.message : String(failure);
      } finally {
        working.value = false;
      }
    };
    media.start();
    recorder.value = media;
    recording.value = true;
  } catch {
    // Permission denied, no device, or an insecure origin. All three read the same to the operator,
    // and all three have the same workaround.
    error.value = 'The microphone could not be reached. Type the question instead.';
  }
};
</script>

<template>
  <div class="agent-audio-input">
    <button
      type="button"
      :disabled="working"
      :aria-pressed="recording"
      :aria-label="recording ? 'Stop recording' : 'Record a question'"
      @click="toggle"
    >
      {{ recording ? 'Stop' : working ? 'Transcribing' : 'Record' }}
    </button>
    <p v-if="error" class="agent-audio-error" role="status">{{ error }}</p>
  </div>
</template>
