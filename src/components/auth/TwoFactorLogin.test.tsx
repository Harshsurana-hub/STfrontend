import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TwoFactorLogin } from './TwoFactorLogin';

describe('TwoFactorLogin', () => {
  it('calls onVerify with the entered code on submit', async () => {
    const onVerify = vi.fn().mockResolvedValue(undefined);
    render(<TwoFactorLogin onVerify={onVerify} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/authenticator code/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verify/i }));
    expect(onVerify).toHaveBeenCalledWith('123456');
  });

  it('strips non-digit input and caps the code at 6 characters', async () => {
    const user = userEvent.setup();
    render(<TwoFactorLogin onVerify={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByLabelText(/authenticator code/i) as HTMLInputElement;

    await user.type(input, 'a1b2c3d4e5f6g7h8');

    expect(input.value).toBe('123456');
  });

  it('does not call onVerify when the code fails schema validation', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockResolvedValue(undefined);
    render(<TwoFactorLogin onVerify={onVerify} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/authenticator code/i), '123');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(onVerify).not.toHaveBeenCalled();
    expect(screen.getByText(/code must be 6 digits/i)).toBeInTheDocument();
  });

  it('renders the rejection message and re-enables submit when onVerify rejects', async () => {
    const user = userEvent.setup();
    const onVerify = vi.fn().mockRejectedValue(new Error('Invalid code'));
    render(<TwoFactorLogin onVerify={onVerify} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/authenticator code/i), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    expect(await screen.findByText('Invalid code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeEnabled();
  });

  it('resets the input value when toggling backup-code mode', async () => {
    const user = userEvent.setup();
    render(<TwoFactorLogin onVerify={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/authenticator code/i) as HTMLInputElement;
    await user.type(input, '123456');
    expect(input.value).toBe('123456');

    await user.click(screen.getByLabelText(/use backup code instead/i));

    const backupInput = screen.getByLabelText(/backup code/i) as HTMLInputElement;
    expect(backupInput.value).toBe('');
  });
});
