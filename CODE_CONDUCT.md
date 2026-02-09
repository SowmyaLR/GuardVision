# GuardVision — Contribution Guidelines

Thank you for contributing to **GuardVision** 🎯  
This project welcomes contributors from beginners to experienced engineers. To keep the repository stable, secure, and collaborative, please follow the guidelines below.

---

## 1. Code of Conduct

We follow a *respect-first* open source culture.

### Our Standards
Participants in this project must:
- Be respectful and inclusive in communication
- Welcome newcomers and help them grow
- Provide constructive feedback (not criticism of the person)
- Accept maintainers’ decisions gracefully
- Focus on improving the project, not winning arguments

### Unacceptable Behaviour
The following will **not be tolerated**:
- Personal attacks, harassment, or discrimination
- Mocking beginners or discouraging questions
- Spam PRs or intentionally low‑effort contributions
- Plagiarized code or AI‑generated code without understanding
- Pushing code directly to protected branches

Maintainers may warn, block, or remove contributors who violate this policy.

---

## 2. Branching Strategy (IMPORTANT 🚨)

`main` branch is **protected and production‑safe**.
Nothing should break it — ever.

### Never Do
❌ Do NOT push directly to `main`  
❌ Do NOT merge your own PR without approval  
❌ Do NOT open PR with broken build/tests

---

### Correct Workflow

1. **Fork the repository**
2. **Create a new branch from latest main**

```
git checkout main
git pull origin main
git checkout -b feature/<short-description>
```

Branch naming rules:

| Type | Example |
|----|----|
| Feature | feature/image-redaction |
| Bug Fix | fix/upload-error |
| Refactor | refactor/api-cleanup |
| Docs | docs/readme-update |
| Test | test/model-validation |

3. **Make small focused commits**

Good:
```
Add face detection threshold config
```
Bad:
```
update files
```

4. **Push to your fork**

```
git push origin feature/image-redaction
```

5. **Create Pull Request → base: dev (NOT main)**

`main` is release-only. All contributions must first go into `dev` branch. Changes reach `main` only after project owner verification.

---

## 3. Pull Request Rules

Your PR will be reviewed only if:

- Builds successfully
- Does not break existing features
- Has meaningful commit messages
- PR description explains WHY not just WHAT
- Screenshots provided for UI changes

### PR Template (Follow this)

```
## What does this PR do?

## Why is this needed?

## Screenshots / Demo

## Checklist
- [ ] Code compiles
- [ ] No console errors
- [ ] Tested locally
- [ ] Small & focused PR
```

---

## 4. Code Safety Guidelines (Sanity Rules 🧠)

These rules exist to prevent the project from becoming unmaintainable.

### General
- Prefer readability over cleverness
- Avoid unnecessary dependencies
- Do not hardcode secrets / API keys
- Add comments only where logic is non‑obvious
- Follow existing project structure

### AI / Model Related
- Do not change model prompts globally without discussion
- Do not increase cost‑heavy API usage blindly
- Avoid blocking operations in request path
- Always add fallback handling for AI failures

### Backend Safety
- Never trust user input
- Validate file types and size
- Avoid large memory allocations
- Add timeout handling for external services

### Frontend Safety
- No inline hacks to bypass validation
- Avoid unnecessary re‑renders
- Do not introduce UI breaking changes without screenshots

---

## 5. Review & Merge Policy

- **Project owner approval is mandatory before merge**
- Large PRs may require changes before merge
- Maintainers may refactor your code before merging
- Repeated low‑quality PRs may be closed

---

## 6. First Contribution Tips 💡

Good first contributions:
- Improve error messages
- Add validations
- Fix edge case bugs
- Add test cases
- Improve documentation

Avoid starting with:
- Major architecture changes
- Rewriting core logic
- Adding new frameworks

---

## 7. Communication

If unsure → ask before coding.

Open a **discussion/issue** before implementing big ideas.

We value learning and collaboration more than speed ❤️

---

Happy Contributing 🚀

