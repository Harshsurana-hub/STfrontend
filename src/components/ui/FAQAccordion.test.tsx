import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAQAccordion } from './FAQAccordion';

const items = [
  {
    question: 'What is the first question?',
    answer: 'This is the first answer.',
  },
  {
    question: 'What is the second question?',
    answer: 'This is the second answer.',
  },
];

describe('FAQAccordion', () => {
  it('renders each question as a button', () => {
    render(<FAQAccordion items={items} />);

    expect(
      screen.getByRole('button', { name: /first question/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /second question/i }),
    ).toBeInTheDocument();
  });

  it('toggles aria-expanded and answer visibility on click', async () => {
    const user = userEvent.setup();
    render(<FAQAccordion items={items} />);

    const trigger = screen.getByRole('button', { name: /first question/i });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('This is the first answer.')).not.toBeVisible();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('This is the first answer.')).toBeVisible();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('This is the first answer.')).not.toBeVisible();
  });
});
