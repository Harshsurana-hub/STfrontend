import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CertificateTemplate, type CertificateTemplateProps } from '../index';

const props: CertificateTemplateProps = {
  studentName: 'Amina Okafor',
  courseTitle: 'Advanced Tailoring Techniques',
  instructorName: 'Jane Doe',
  certificateId: 'cert-123',
  issuedAt: '2024-03-05T12:00:00.000Z',
  isValid: true,
};

describe('certificate barrel (src/components/certificate/index.ts)', () => {
  it('re-exports CertificateTemplate', () => {
    expect(CertificateTemplate).toBeTypeOf('function');
  });

  it('renders the student, course, instructor, formatted issue date and verification status', () => {
    render(<CertificateTemplate {...props} />);

    expect(screen.getByRole('heading', { name: 'Amina Okafor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced Tailoring Techniques' })).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Mar 5, 2024')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/verified on stellar blockchain/i);
  });

  it('renders the digital layout with the same fields', () => {
    render(<CertificateTemplate {...props} variant="digital" />);

    expect(screen.getByRole('heading', { name: 'Amina Okafor' })).toBeInTheDocument();
    expect(screen.getByText('Advanced Tailoring Techniques')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Mar 5, 2024')).toBeInTheDocument();
  });

  it('shows an unverified status for an invalid certificate', () => {
    render(<CertificateTemplate {...props} isValid={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(/not verified/i);
  });
});
