// Prompt templates are plain .md files, bundled as text by esbuild.
declare module '*.md' {
  const text: string;
  export default text;
}
