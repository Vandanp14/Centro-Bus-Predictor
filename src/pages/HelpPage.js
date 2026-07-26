import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiChevronDown,
  FiClock,
  FiHelpCircle,
  FiMap,
  FiRadio,
} from 'react-icons/fi';

const questions = [
  {
    question: 'What does “Due” mean?',
    answer:
      'Centro is estimating that the bus is at or less than about one minute from the stop. Move to the boarding area and watch for the route number.',
  },
  {
    question: 'Why can a route have no prediction?',
    answer:
      'Centro may have no scheduled service, the next trip may be too far away to predict, or a vehicle may not be reporting. Use the official schedule to confirm planned service.',
  },
  {
    question: 'Are the dots on the map really buses?',
    answer:
      'Yes. Filled route-color markers are vehicle positions returned by Centro BusTime. Small white circles are stops. When no vehicle is reporting, the app says so instead of showing a fake bus.',
  },
  {
    question: 'How often does the app refresh?',
    answer:
      'Arrival estimates refresh every 30 seconds. Vehicle positions refresh every 15 seconds while the live map is open and visible.',
  },
  {
    question: 'What does “Centro reports a delay” mean?',
    answer:
      'The delayed flag comes from Centro BusTime for that vehicle. It is not a delay calculated by this app and does not replace the live arrival estimate.',
  },
  {
    question: 'Is this an official Centro app?',
    answer:
      'No. This is an independent SUNY Oswego student project using Centro BusTime data. Official schedules, alerts, fares, and accessibility information remain on centro.org.',
  },
];

function HelpPage() {
  return (
    <main className="page help-page">
      <header className="page-heading">
        <p className="eyebrow">
          <FiHelpCircle aria-hidden="true" />
          Rider guide
        </p>
        <h1>Read the signal.</h1>
        <p>
          The app separates live estimates, vehicle locations, and official
          schedules so you always know what the data means.
        </p>
      </header>

      <section className="help-primer" aria-label="How the app works">
        <article>
          <span>01</span>
          <FiRadio aria-hidden="true" />
          <h2>Pick a stop</h2>
          <p>Choose the same route, direction, and stop shown at your shelter.</p>
        </article>
        <article>
          <span>02</span>
          <FiClock aria-hidden="true" />
          <h2>Read the countdown</h2>
          <p>The first number is Centro’s live estimate, not a static schedule.</p>
        </article>
        <article>
          <span>03</span>
          <FiMap aria-hidden="true" />
          <h2>Check the map</h2>
          <p>See the route line, official stops, and buses currently reporting.</p>
        </article>
      </section>

      <section className="faq-section" aria-labelledby="faq-title">
        <header>
          <p className="eyebrow">Common questions</p>
          <h2 id="faq-title">Before you board</h2>
        </header>
        <div className="faq-list">
          {questions.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <FiChevronDown aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="help-cta">
        <div>
          <span className="live-dot" aria-hidden="true" />
          <span>
            Ready to ride?
            <strong>Find your next Centro bus.</strong>
          </span>
        </div>
        <Link className="button button--primary" to="/">
          Check arrivals
          <FiArrowRight aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}

export default HelpPage;
