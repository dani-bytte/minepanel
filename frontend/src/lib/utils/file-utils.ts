import { FileItem } from "@/services/files/files.service";

export const TEXT_EXTENSIONS = [
  // Config
  "txt", "json", "yml", "yaml", "properties", "cfg", "conf", "xml", "toml", "ini", "env",
  // Scripts
  "sh", "bat", "ps1", "cmd",
  // Docs
  "md", "log", "csv",
  // Minecraft
  "mcmeta", "lang",
  // Code
  "java", "js", "ts", "py", "lua", "sk", "php", "c", "cpp", "h", "cs", "go", "rs", "rb",
  // Data
  "html", "css", "scss", "sql",
];

export const isEditableFile = (file: FileItem): boolean => {
  if (file.isDirectory) return false;
  
  // Se não tem extensão e não é diretório (ex: arquivo 'whitelist' ou 'ops'), deixamos tentar abrir como texto
  if (!file.extension) return true;
  
  return TEXT_EXTENSIONS.includes(file.extension.toLowerCase());
};
