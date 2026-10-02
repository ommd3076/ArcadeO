import fs from "node:fs";
export default async function teardown() {
  const { token } = JSON.parse(fs.readFileSync(".local/browser-control.json", "utf8"));
  await fetch("http://127.0.0.1:8790/shutdown", {
    method: "POST",
    headers: { Authorization: token },
  });
}
