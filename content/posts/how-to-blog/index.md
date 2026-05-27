---
title: "How to post on the Code Engine Dev Blog"
date: 2026-05-27
description: "A comprehensive guide for authors contributing to the IBM Code Engine blog using Hugo and the Blowfish theme."
tags: ["meta", "guide", "documentation", "hugo"]
featureImage: "featured.jpg"
authors: ["uwefassnacht"]
draft: false
---

Welcome to the **IBM Code Engine Developer Blog** contribution guide! This site is powered by Hugo and built using the highly customizable Blowfish Theme. 

To maintain a consistent reading experience, please follow this step-by-step workflow to configure your author bio, format your posts, and submit content.

---

## 1. Setting Up Your Author Profile

Before writing your first post, you must create an author profile. This generates a rich bio card at the bottom of your articles and populates the global author index pages.

1. **Create Your Author Directory:** Navigate to `content/authors/` in the repository. Create a new directory named exactly after your author handle (use lowercase and hyphens, e.g., `content/authors/john-doe/`).
2. **Create the Profile Configuration:** Inside your new folder, create an `_index.md` file. This file holds your profile metadata and biography.
3. **Add Your Profile Image:** Place an avatar image (JPG or PNG, ideally square) into your author folder. Name it `avatar.jpg` or `avatar.png`. Blowfish will detect and render it automatically.

### Author Template
Copy and paste this structure into your `content/authors/<your-name>/_index.md` file:

````toml
---
title: "John Doe"
searchHidden: true # Keeps your profile page out of general article searches
# Social Media Links
links:
  - github: "https://github.com/your-username"
  - linkedin: "https://linkedin.com/in/your-profile"
  - twitter: "https://twitter.com/your-handle"
---

Write a short, engaging 2-3 sentence biography here. Explain your role at IBM, your technical focus areas (like Cloud Native Serverless systems, Kubernetes, or Knative), and what you enjoy working on outside of coding.
````

---

## 2. Creating a New Post

All articles are written in standard Markdown and live inside the `content/posts/` directory.

### Step 1: Create the File
Create a new file named `your-post-title.md` inside `content/posts/`.

### Step 2: Configure Front Matter
Every article requires a block of configuration at the absolute top of the file, wrapped in triple hyphens (`---`). Use this exact template:

```yaml
---
title: "Deploying Microservices with Code Engine"
date: 2026-05-27
description: "A deep dive into deploying containerized applications with minimal infrastructure configuration."
tags: ["code-engine", "serverless", "containers"]
categories: ["tutorials"]
author: "john-doe" # Must exactly match your folder name in content/authors/
showTaxonomies: true
showAuthor: true
showAuthorBottom: true
---
````

> **Crucial Rule:** Ensure the `author` string matches your author profile directory name exactly. If it doesn't, your bio card won't load and global author filtering will fail.

---

## 3. Formatting and Styling Content

Blowfish includes rich utility components to make your content visually engaging. Make sure to review the Official Blowfish Content Structure Guide ([https://blowfish.page/docs/content/](https://blowfish.page/docs/content/)) for comprehensive examples.

### Code Snippets and Syntax Highlighting
Always specify the programming language next to your opening backticks to enable clean code block rendering:

```javascript
// Example of clean syntax highlighting
const client = new CodeEngineClient();
await client.deployApplication("my-app");
```

### Shortcodes and Alerts
Blowfish provides elegant custom components called "shortcodes" to call out critical details or warnings.

* **Alert Boxes:** Use these to emphasize specific configurations or caveats. Read more in the Blowfish Alert Shortcode Docs ([https://blowfish.page/docs/shortcodes/#alert](https://blowfish.page/docs/shortcodes/#alert)).
  

  {{< alert >}}
  **Note:** Code Engine projects automatically scale to zero instances when idle to save resource costs.
  {{< /alert >}}

* **Badges:** Highlight small snippets of inline metadata using the Blowfish Badge Documentation ([https://blowfish.page/docs/shortcodes/#badge](https://blowfish.page/docs/shortcodes/#badge)).

---

## 4. Submission Checklist

Before opening a Pull Request (PR) on GitHub, ensure you check off the following items:

* [ ] My author profile exists under `content/authors/` and contains an `_index.md`.
* [ ] The `theme` variable is **not** present in `hugo.toml` (all module imports are handled natively by Go Modules).
* [ ] All tags and categories are lowercase string arrays (e.g., `tags: ["cloud", "devops"]`).
* [ ] I have verified all custom text comparison layouts use clean string descriptors instead of naked `<` or `>` characters to avoid parsing errors.
* [ ] All referenced images are placed contextually or within assets, avoiding broken links.

For advanced stylistic tweaks, layout adjustments, or multi-language configurations, consult the complete Blowfish Theme Documentation Hub ([https://blowfish.page/docs/](https://blowfish.page/docs/)).
