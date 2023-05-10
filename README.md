# Firebase CLI & Web Frameworks

## Frameworks

| Framework  | Support | |
| ---------- | ------- | - |
| [Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs) | **Early preview** | |
| [Angular](https://firebase.google.com/docs/hosting/frameworks/angular) | **Early preview** | |
| [Express](https://firebase.google.com/docs/hosting/frameworks/express) | **Early preview** | |
| Flask | **Early preview** | Coming soon... |
| Django | Experimental | Coming soon... |
| Flutter | Experimental | |
| Nuxt | Experimental | |
| Astro | Experimental | |
| SvelteKit | Experimental | |
| Preact<br>React<br>Lit<br>Svelte<br>and more... | Experimental | Static web apps, powered by *Vite* |

## Overview

Firebase Hosting integrates with popular modern web frameworks including Angular and Next.js. Using Firebase Hosting and
Cloud Functions for Firebase with these frameworks, you can develop apps and microservices in your preferred framework
environment, and then deploy them in a managed, secure server environment. Support during this early preview includes
the following functionality:

* Deploy Web apps comprised of static web content
* Deploy Web apps that use pre-rendering / Static Site Generation (SSG)
* Deploy Web apps that use server-side Rendering (SSR)—full server rendering on demand

Firebase provides this functionality through the Firebase CLI. When initializing Hosting on the command line, you
provide information about your new or existing Web project, and the CLI sets up the right resources for your chosen Web
framework.

## Status

![Status: Experimental](https://img.shields.io/badge/Status-Experimental-blue)

This repository is maintained by Google but is not a supported Firebase product. Issues here are answered by
maintainers and other community members on GitHub on a best-effort basis.

## Enable framework-awareness

An experimental add-on to the Firebase CLI provides web framework support. To enable it, call the following:

```shell
firebase experiments:enable webframeworks
```

## Prerequisites

- Firebase CLI version 10.9.1 or later (see installation instructions [here](https://firebase.google.com/docs/cli))


## Initialize Firebase Hosting

When you initialize Firebase Hosting it should automatically detect known Web Frameworks, if one isn't discovered
you'll be given a list of supported frameworks to start with.

```shell
firebase init hosting
```

## Serve locally

You can test your integration locally by following these steps:

1. Run `firebase emulators:start` from the terminal. This should build your app and serve it using the Firebase CLI.
2. Open your web app at the local URL returned by the CLI (usually http://localhost:5000).

## Deploy your app to Firebase Hosting

When you're ready to share your changes with the world, deploy your app to your live site:

1. Run `firebase deploy` from the terminal.
2. Check your website on: `SITE_ID.web.app` or `PROJECT_ID.web.app` (or your custom domain, if you set one up)

# Contributors

We'd love to accept your patches and contributions to this project. There are just a few small guidelines you need to
follow. [See CONTRIBUTING](./CONTRIBUTING.md).

## Building

```bash
$ cd <YOUR-GIT-CHECKOUT>
$ npm i
$ npm run build
```
