import React from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";

export function renderToHtml(element: React.ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough();
    let html = "";
    let didError = false;
    let abortStream = () => {};
    const timeout = setTimeout(() => {
      abortStream();
      reject(new Error("Streaming server render exceeded five seconds"));
    }, 5000);

    output.on("data", (chunk: Buffer | string) => {
      html += chunk.toString();
    });
    output.on("end", () => {
      clearTimeout(timeout);
      if (didError) reject(new Error("Streaming server render failed"));
      else resolve(html);
    });
    output.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });

    const stream = renderToPipeableStream(element, {
      onAllReady() {
        stream.pipe(output);
      },
      onShellError(error) {
        didError = true;
        reject(error);
      },
      onError() {
        didError = true;
      },
    });
    abortStream = () => stream.abort();
  });
}
