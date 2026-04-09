import { useEffect, useRef } from "react";

export function looksLikeHtml(s: string): boolean {
  const t = s.trim();
  return /^\s*<!doctype\s+html/i.test(t) || /^\s*<html[\s>]/i.test(t);
}

export function HtmlResponseViewer({ html, maxHeight = 240 }: { html: string; maxHeight?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);
  return (
    <iframe
      ref={ref}
      sandbox=""
      style={{
        width: "100%",
        height: maxHeight,
        border: "1px solid rgba(128,128,128,0.3)",
        borderRadius: 6,
        background: "#fff",
      }}
      title="HTML Response"
    />
  );
}
