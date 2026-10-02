<script setup lang="ts">
import { ref } from 'vue';
import { prepareImages, removeImage, type PreparedImage } from './lib/attachments.ts';

// Images for one question. Dropping or pasting is the fast path; the button exists because the native
// file dialog is still the only way to reach a file that is not already on screen.
//
// No styles here either: the classes are the app's.
const props = defineProps<{ inputId: string; newId: () => string }>();
const images = defineModel<PreparedImage[]>({ required: true });

const picker = ref<HTMLInputElement | null>(null);
const dropping = ref(false);
const error = ref('');

const take = async (files: FileList | File[] | null): Promise<void> => {
  const list = [...(files ?? [])].filter(file => file.type.startsWith('image/') || file.size > 0);
  if (!list.length) return;
  const prepared = await prepareImages(images.value, props.inputId, list, props.newId);
  images.value = prepared.images;
  error.value = prepared.error;
};

const onDrop = (event: DragEvent): void => {
  dropping.value = false;
  void take(event.dataTransfer?.files ?? null);
};

const onPicked = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  // Cleared so picking the same file twice in a row still fires a change event.
  input.value = '';
  void take(files);
};

// Pasting a screenshot is how most of these arrive.
const onPaste = (event: ClipboardEvent): void => {
  const files = [...(event.clipboardData?.files ?? [])];
  if (files.length) void take(files);
};

defineExpose({ onPaste });
</script>

<template>
  <div
    class="agent-image-input"
    :class="{ 'is-dropping': dropping }"
    @dragover.prevent="dropping = true"
    @dragleave="dropping = false"
    @drop.prevent="onDrop"
    @paste="onPaste"
  >
    <ul aria-label="Attached images">
      <li v-for="(image, index) in images" :key="image.id" class="agent-image">
        <img :src="image.preview" :alt="`Image ${index + 1}: ${image.name}`">
        <button
          type="button"
          :aria-label="`Remove image ${index + 1}: ${image.name}`"
          @click="images = removeImage(images, image.id)"
        >Remove</button>
      </li>
    </ul>
    <button type="button" @click="picker?.click()">Add images</button>
    <input
      ref="picker"
      type="file"
      class="agent-image-picker"
      :aria-label="`Choose images for ${inputId}`"
      accept="image/png,image/jpeg,image/webp,image/gif"
      multiple
      @change="onPicked"
    >
    <p v-if="error" class="agent-image-error" role="status">{{ error }}</p>
  </div>
</template>
