import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeamGrid } from './TeamGrid';

describe('TeamGrid', () => {
  it('renders a card per member with name and role', () => {
    render(<TeamGrid members={[{ id: '1', name: 'Ada Lovelace', role: 'Founder', image: '/a.jpg' }]} />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Founder')).toBeInTheDocument();
  });

  it('renders the member photo when an image is provided', () => {
    render(<TeamGrid members={[{ id: '1', name: 'Ada Lovelace', role: 'Founder', image: '/a.jpg' }]} />);
    const photo = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(photo.tagName).toBe('IMG');
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
  });

  it('renders initials instead of an image when the image is an empty string', () => {
    const { container } = render(
      <TeamGrid members={[{ id: '1', name: 'Ada Lovelace', role: 'Founder', image: '' }]} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('switches to the initials fallback when the image fails to load', () => {
    const { container } = render(
      <TeamGrid members={[{ id: '1', name: 'Grace Hopper', role: 'Engineer', image: '/broken.jpg' }]} />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('GH')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Grace Hopper' })).toBeInTheDocument();
  });
});
