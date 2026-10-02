import {
  inspectImageBytes,
  MAX_AGENT_IMAGES,
  MAX_AGENT_IMAGE_BYTES,
  type AgentImage,
  type AgentImageMediaType,
} from '../../contracts/agent.ts';

// Preparing what the operator drops, pastes, picks or records, before any of it reaches a request.
//
// EVERY CHECK HERE IS ALSO ON THE SERVER. This half exists so the operator gets a sentence about
// what is wrong instead of a rejected request; it is not the boundary.

export type PreparedImage = AgentImage & {
  /** A data URL for the thumbnail. Held only while the input is open. */
  preview: string;
};

export type Prepared = { images: PreparedImage[]; error: string };

const base64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const prepareImages = async (
  current: PreparedImage[],
  inputId: string,
  files: File[],
  newId: () => string,
): Promise<Prepared> => {
  if (current.length + files.length > MAX_AGENT_IMAGES) {
    return { images: current, error: `Add at most ${MAX_AGENT_IMAGES} images to one question.` };
  }
  const prepared: PreparedImage[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0) return { images: current, error: `${file.name} is empty.` };
    if (bytes.length > MAX_AGENT_IMAGE_BYTES) {
      return { images: current, error: `${file.name} is larger than ${Math.floor(MAX_AGENT_IMAGE_BYTES / 1024 / 1024)} MB.` };
    }
    // THE BYTES DECIDE, not file.type and not the extension. A .png that is not one reaches the CLI
    // as whatever it actually is, and the CLI's error will be about something else entirely.
    const mediaType: AgentImageMediaType | null = inspectImageBytes(bytes);
    if (!mediaType) return { images: current, error: `${file.name} is not a PNG, JPEG, WebP or GIF.` };
    const encoded = base64(bytes);
    prepared.push({
      id: newId(),
      inputId,
      name: file.name,
      mediaType,
      size: bytes.length,
      bytes: encoded,
      preview: `data:${mediaType};base64,${encoded}`,
    });
  }
  return { images: [...current, ...prepared], error: '' };
};

export const removeImage = (images: PreparedImage[], id: string): PreparedImage[] =>
  images.filter(image => image.id !== id);

/** What goes in the request: the preview is a duplicate of the bytes and would double the payload. */
export const requestImages = (images: PreparedImage[]): AgentImage[] =>
  images.map(({ preview: _preview, ...image }) => image);

// --- Audio -----------------------------------------------------------------

/** AUDIO IS NOT AN AGENT INPUT. Neither CLI takes it, so a voice question is transcribed first and
 *  the text is what the agent sees. That transcription is a plain API call (a dedicated speech
 *  recogniser, paid by the second) and stays wherever the app's other plain model calls live. */
export const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
};

export const baseMediaType = (value: string): string => value.split(';')[0]!.trim().toLowerCase();

/** Safari records MP4, everything else WebM or Ogg. The file name follows the type the browser
 *  actually produced, because a .webm that is an MP4 confuses whatever reads it next. */
export const recordingFileName = (mediaType: string, now = Date.now()): string =>
  `recording-${now}.${AUDIO_EXTENSIONS[baseMediaType(mediaType)] ?? 'webm'}`;
