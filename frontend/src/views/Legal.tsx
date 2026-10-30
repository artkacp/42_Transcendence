import type { ReactNode } from 'react'

/*
 * (◕◕) Privacy Policy + Terms of Service — required by the subject (III.2):
 * reachable from the app (footer links) and with real, relevant content.
 * Keep the text in sync with what the backend actually stores.
 */

function Page({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="max-w-2xl space-y-6 text-text">
      <header>
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: {updated}</p>
      </header>
      {children}
    </article>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-muted">{children}</div>
    </section>
  )
}

export function PrivacyPolicy() {
  return (
    <Page title="Privacy Policy" updated="October 2026">
      <p className="text-sm leading-relaxed text-text-muted">
        Pawfect Match is a student project built at 42 Warsaw. It connects people who need to
        rehome a dog or cat with people who want to adopt one. This page explains what data we
        keep and why.
      </p>
      <Block title="What we collect">
        <p>Account data: your email address and a hashed password. We never store your password in plain text.</p>
        <p>Profile data you choose to add: display name, city, avatar and a short bio.</p>
        <p>Pet listings you publish: photos, description, breed, age and city.</p>
        <p>Messages and attachments you exchange with other users about an adoption.</p>
      </Block>
      <Block title="How we use it">
        <p>To run the service: signing you in, showing listings, delivering messages and notifications, and keeping adoption conversations working. Activity data is used only as described under Analytics.</p>
        <p>We do not sell your data, show ads or share it with third parties.</p>
      </Block>
      <Block title="Analytics">
        <p>We record an activity event when you view a pet page, send an adoption inquiry, send a message, complete an adoption, publish a listing or register.</p>
        <p>Events are stored in our own PostgreSQL database, tied to your account, and include a snapshot of the pet's features.</p>
        <p>They feed the platform-wide dashboard, in aggregated form, and your own Activity page. They are not shared with third parties.</p>
      </Block>
      <Block title="Who can see what">
        <p>Your profile, avatar and pet listings are visible to other signed-in users.</p>
        <p>Messages and chat attachments are visible only to the people in that conversation.</p>
      </Block>
      <Block title="Cookies">
        <p>We use a single secure, http-only cookie to keep you signed in. No advertising or third-party tracking cookies.</p>
      </Block>
      <Block title="Your rights">
        <p>You can edit your profile at any time. To delete your account, contact the team through the project repository.</p>
        <p>Questions about your data: contact the team through the project repository.</p>
      </Block>
    </Page>
  )
}

export function TermsOfService() {
  return (
    <Page title="Terms of Service" updated="October 2026">
      <p className="text-sm leading-relaxed text-text-muted">
        By creating an account on Pawfect Match you agree to these terms. Pawfect Match is a
        non-commercial student project built at 42 Warsaw.
      </p>
      <Block title="Using the service">
        <p>You must provide a valid email address and keep your password private.</p>
        <p>One person, one account. You are responsible for what happens under your account.</p>
      </Block>
      <Block title="Listings and adoptions">
        <p>Only list dogs or cats that you are actually responsible for, with honest descriptions and your own photos.</p>
        <p>Pawfect Match only connects people. Adoptions are agreed directly between users; we do not verify animals, homes or identities, and we are not a party to any agreement.</p>
        <p>No selling: listings must not ask for money beyond a reasonable, openly stated adoption fee.</p>
      </Block>
      <Block title="Behaviour">
        <p>Be respectful in messages. Harassment, spam, scams and offensive content are not allowed.</p>
        <p>We may remove content or suspend accounts that break these rules.</p>
      </Block>
      <Block title="No warranty">
        <p>The service is provided as is, as a learning project. It may be unavailable or change without notice.</p>
      </Block>
    </Page>
  )
}
