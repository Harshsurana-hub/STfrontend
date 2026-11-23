import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Footer } from "./Footer";
import { newsletterApi } from "@/lib/api/services";

vi.mock("@/lib/api/services", () => ({
  newsletterApi: {
    subscribe: vi.fn(),
  },
}));

describe("Footer NewsletterForm (#85)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders success message when newsletter subscription succeeds", async () => {
    vi.mocked(newsletterApi.subscribe).mockResolvedValueOnce(undefined);

    render(<Footer />);

    const input = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", { name: "Subscribe" });

    fireEvent.change(input, { target: { value: "user@example.com" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(newsletterApi.subscribe).toHaveBeenCalledWith("user@example.com");
      const statusMessage = screen.getByRole("status");
      expect(statusMessage).toBeInTheDocument();
      expect(statusMessage).toHaveTextContent(
        /You're in! Thanks for subscribing/i,
      );
    });
  });

  it("renders server error alert when newsletter subscription rejects", async () => {
    vi.mocked(newsletterApi.subscribe).mockRejectedValueOnce(
      new Error("Email already subscribed."),
    );

    render(<Footer />);

    const input = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", { name: "Subscribe" });

    fireEvent.change(input, { target: { value: "existing@example.com" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(newsletterApi.subscribe).toHaveBeenCalledWith(
        "existing@example.com",
      );
      const errorAlert = screen.getByRole("alert");
      expect(errorAlert).toBeInTheDocument();
      expect(errorAlert).toHaveTextContent("Email already subscribed.");
      expect(errorAlert).toHaveAttribute("id", "nl-server-error");
    });
  });

  it("shows client validation error and does not call API on invalid email", async () => {
    render(<Footer />);

    const input = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", { name: "Subscribe" });

    fireEvent.change(input, { target: { value: "invalid-email" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(newsletterApi.subscribe).not.toHaveBeenCalled();
      const errorAlert = screen.getByRole("alert");
      expect(errorAlert).toHaveTextContent(
        "Please enter a valid email address.",
      );
      expect(errorAlert).toHaveAttribute("id", "nl-email-error");
    });
  });
});
