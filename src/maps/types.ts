export type Region = {
  id: string;
  name: string;
  group?: string;
  sizeMB: number;
  sizeBytes?: number;
  bbox: [number, number, number, number]; // запад, юг, восток, север
  urls: string[]; // несколько ссылок-зеркал: пробуются по очереди
};