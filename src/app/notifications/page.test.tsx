import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import NotificationsPage from "./page";
import { notificationsApi } from "@/lib/api/services";

vi.mock("@/lib/api/services", () => ({
  notificationsApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

const mockNotifications = [
  {
    id: "notif-1",
    userId: "user-1",
    type: "COURSE_APPROVED",
    title: "Course Approved",
    message: "Your course has been approved.",
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "notif-2",
    userId: "user-1",
    type: "PAYMENT_RECEIVED",
    title: "Payment Received",
    message: "You received a payment.",
    read: true,
    createdAt: new Date().toISOString(),
  },
];

describe("NotificationsPage Accessibility (#124)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the feed as a labelled list with an accessible name", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      data: mockNotifications,
      status: 200,
    } as any);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("list", { name: "Notifications" }),
      ).toBeInTheDocument();
    });
  });

  it("provides accessible names indicating read/unread status and title on buttons", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      data: mockNotifications,
      status: 200,
    } as any);

    render(<NotificationsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Unread notification: Course Approved",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "Read notification: Payment Received",
        }),
      ).toBeInTheDocument();
    });
  });

  it("marks an unread notification as read when clicked", async () => {
    vi.mocked(notificationsApi.list).mockResolvedValueOnce({
      data: mockNotifications,
      status: 200,
    } as any);
    vi.mocked(notificationsApi.markRead).mockResolvedValueOnce({} as any);

    render(<NotificationsPage />);

    const unreadButton = await screen.findByRole("button", {
      name: "Unread notification: Course Approved",
    });
    fireEvent.click(unreadButton);

    expect(notificationsApi.markRead).toHaveBeenCalledWith("notif-1");
  });
});
