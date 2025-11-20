
export interface RenderOptions {
  style: string;
  type: string;
  context: string;
  weather: string;
  time: string;
  view: string;
}

export interface RenderResultItem {
  id: string;
  sketch: string;
  final: string;
  prompt: string;
  options: RenderOptions;
}

export interface UploadedFile {
  base64: string;
  mimeType: string;
  name: string;
}
