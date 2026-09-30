import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "../theme";
import { router } from "./router";
import "../theme/theme.css";

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
