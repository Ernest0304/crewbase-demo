# CrewBASE — demo

A working demo of **CrewBASE**, a phone-first handover and task app for staff
who run shared commercial kitchen sites.

**Open it: https://ernest0304.github.io/crewbase-demo/**

Everything here is invented — the sites, the operators, the people and the
faults. There is no backend: the demo answers from memory so anyone can click
through it. Any four digits work as a PIN.

## What it is for

A kitchen site runs across shifts. Somebody notices a cold room drifting warm
at 6pm and goes off duty at 10; unless that lands somewhere the next person
looks, it is found again three days later by a licensee. CrewBASE is where
that gets written down, handed to a named colleague, and closed with a note
saying how it was actually resolved.

## What to try

- **Continue as** — the login screen remembers who signed in on this device,
  so nobody hunts a roster for their own name. Sites share handsets, so the
  session locks after five idle minutes.
- **Log** — file an item against a kitchen, set how soon it must be resolved,
  and watch the countdown badge on the card.
- **Today** — "Handed to you" is pinned at the top; a blue dot marks anything
  that changed since your last visit.
- **Handover** — before a day off, the app walks every open item at your site
  one at a time: update it, hand it over, complete it, or leave it.
- **Moves** — licensees moving in and out, so a kitchen changing hands is
  scheduled rather than discovered.

## Notes

The real app is private: it runs against a live operations sheet with staff
PINs and real handovers, which is not something to put on a public page. This
repository is generated from the same source with the network layer replaced
by an in-memory stand-in.

Built with no framework — plain HTML, CSS and JavaScript.
