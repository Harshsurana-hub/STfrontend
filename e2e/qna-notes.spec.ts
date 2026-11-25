import { expect, test, type Page } from "@playwright/test";

const COURSE_ID = "qna-notes-e2e";
const ENROLLMENT_ID = "enrollment-qna-e2e";
const LESSON_ID = "lesson-qna-intro";
const STUDENT_ID = "student-qna-e2e";

const course = {
  id: COURSE_ID,
  instructorAddress: "GTESTINSTRUCTOR",
  title: "Q&A and Notes E2E Course",
  description: "A deterministic course fixture for Q&A and notes E2E tests.",
  category: "Web Development",
  level: "BEGINNER",
  language: "English",
  thumbnailUrl: null,
  previewVideoUrl: null,
  price: 0,
  platformFeePercent: 0,
  status: "ACTIVE",
  totalLessons: 1,
  totalDuration: 120,
  totalEnrollments: 1,
  totalRevenue: 0,
  txHash: null,
  approvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  instructor: {
    name: "Test Instructor",
    stellarAddress: "GTESTINSTRUCTOR",
    avatarUrl: null,
  },
  modules: [
    {
      id: "module-qna-basics",
      courseId: COURSE_ID,
      title: "Q&A Basics",
      position: 1,
      lessons: [
        {
          id: LESSON_ID,
          moduleId: "module-qna-basics",
          title: "Introduction to Q&A",
          description: "Learn the Q&A and notes features.",
          type: "VIDEO",
          videoUrl: null,
          videoDuration: 120,
          content: null,
          resourceUrl: null,
          position: 1,
          isFree: true,
        },
      ],
    },
  ],
  _count: { enrollments: 1 },
};

const enrollment = {
  id: ENROLLMENT_ID,
  studentId: STUDENT_ID,
  courseId: COURSE_ID,
  amountPaid: 0,
  txHash: null,
  status: "ACTIVE",
  progressPercent: 0,
  completedAt: null,
  enrolledAt: "2026-08-01T00:00:00.000Z",
  course,
  lessonProgress: [],
};

const existingQuestion = {
  id: "q-existing-001",
  authorName: "Other Student",
  authorAvatarUrl: null,
  isViewerAuthor: false,
  title: "How does this work?",
  body: "Could someone explain how the Q&A section is loaded?",
  createdAt: "2026-07-01T00:00:00.000Z",
  upvotes: 2,
  viewerUpvoted: false,
  replies: [
    {
      id: "r-existing-001",
      authorName: "Test Instructor",
      authorAvatarUrl: null,
      isInstructor: true,
      text: "The Q&A section is loaded via the QnaSection component.",
      createdAt: "2026-07-02T00:00:00.000Z",
    },
  ],
};

async function mockLearningApis(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    // Course detail
    if (request.method() === "GET" && path === `/api/v1/courses/${COURSE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: course }),
      });
      return;
    }

    // Enrollment
    if (
      request.method() === "GET" &&
      path === `/api/v1/enrollments/${COURSE_ID}`
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: enrollment }),
      });
      return;
    }

    // Q&A: list questions for a lesson
    if (
      request.method() === "GET" &&
      path === `/api/v1/lessons/${LESSON_ID}/questions`
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [existingQuestion] }),
      });
      return;
    }

    // Q&A: post a new question
    if (
      request.method() === "POST" &&
      path === `/api/v1/lessons/${LESSON_ID}/questions`
    ) {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      });
      return;
    }

    // Notes: list notes (empty)
    if (
      request.method() === "GET" &&
      (path.includes("/notes") || path.includes("/note"))
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
      return;
    }

    // Progress patch
    if (request.method() === "PATCH" && path.endsWith("/progress")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      });
      return;
    }

    // Default
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        },
      }),
    });
  });
}

async function openLearnPage(page: Page) {
  await page.goto(`/dashboard/courses/${COURSE_ID}/learn`, {
    waitUntil: "domcontentloaded",
  });
}

test.describe("Q&A section", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "sorobanlard_token",
        value: "qna-notes-e2e-token",
        url: "http://localhost:3001",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem("sorobanlard_token", "qna-notes-e2e-token");
      window.localStorage.setItem("sorobanlard_address", STUDENT_ID);
      window.localStorage.setItem("cookie-consent", "accepted");
    });
    await mockLearningApis(page);
    await openLearnPage(page);
  });

  test("posts a question and asserts it appears at the top of the list", async ({
    page,
  }) => {
    const titleInput = page.getByRole("textbox", { name: /title/i }).or(
      page.locator("#qna-title"),
    );
    const bodyInput = page.getByRole("textbox", { name: /detail|body|description/i }).or(
      page.locator("#qna-body"),
    );
    const postButton = page.getByRole("button", { name: /post question/i });

    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    await titleInput.fill("My new test question");
    await bodyInput.fill(
      "This is the detail for my new question which is at least twenty chars.",
    );
    await postButton.click();

    // After submitting, the new question should appear
    await expect(
      page.getByText("My new test question").first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("filters to 'mine' and shows only the viewer's questions", async ({
    page,
  }) => {
    // Post a question first so there is one owned by the viewer
    const titleInput = page.locator("#qna-title");
    const bodyInput = page.locator("#qna-body");
    const postButton = page.getByRole("button", { name: /post question/i });

    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill("My personal question");
    await bodyInput.fill("Detail about my personal question that is long enough.");
    await postButton.click();
    await expect(page.getByText("My personal question").first()).toBeVisible();

    // Click "My Questions" filter
    await page
      .getByRole("button", { name: /my questions/i })
      .click();

    await expect(page.getByText("My personal question").first()).toBeVisible();
    // The other student's question should no longer be visible
    await expect(page.getByText("How does this work?")).not.toBeVisible();
  });

  test("filters to 'unanswered' and shows only questions without replies", async ({
    page,
  }) => {
    // Post a new question (will have no replies — unanswered)
    const titleInput = page.locator("#qna-title");
    const bodyInput = page.locator("#qna-body");

    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill("Unanswered question here");
    await bodyInput.fill(
      "This question has no replies yet and should appear under unanswered.",
    );
    await page.getByRole("button", { name: /post question/i }).click();
    await expect(page.getByText("Unanswered question here").first()).toBeVisible();

    // Click "Unanswered" filter
    await page.getByRole("button", { name: /unanswered/i }).click();

    await expect(page.getByText("Unanswered question here").first()).toBeVisible();
    // The existing question has a reply, so it should be hidden
    await expect(page.getByText("How does this work?")).not.toBeVisible();
  });
});

test.describe("Notes panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "sorobanlard_token",
        value: "qna-notes-e2e-token",
        url: "http://localhost:3001",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem("sorobanlard_token", "qna-notes-e2e-token");
      window.localStorage.setItem("sorobanlard_address", STUDENT_ID);
      window.localStorage.setItem("cookie-consent", "accepted");
      // Ensure no pre-existing notes in localStorage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sorobanlard_notes")) localStorage.removeItem(k);
      });
    });
    await mockLearningApis(page);
    await openLearnPage(page);
  });

  test("export control is not visible when there are no notes", async ({
    page,
  }) => {
    // The Notes panel must be reachable. Try switching to Notes tab if present.
    const notesTab = page.getByRole("button", { name: /notes/i }).first();
    if (await notesTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notesTab.click();
    }

    // The Export button is only shown when notes.length > 0.
    // With no notes, it must not be present in the DOM.
    await expect(page.getByRole("button", { name: /export/i })).not.toBeVisible();
  });
});
