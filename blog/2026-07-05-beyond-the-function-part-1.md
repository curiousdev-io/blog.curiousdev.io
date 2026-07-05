---
title: "Beyond the Function: A Lambda Developer Discovers ECS"
description: "You moved a containerized Lambda to Fargate and it just worked. But Fargate is only one way to run ECS — so what is ECS, really?"
slug: beyond-the-function-lambda-developer-discovers-ecs
authors: [brian]
tags: [aws, ecs, containers, fargate, lambda]
---

You containerized a Lambda function. Then you moved it to AWS Fargate, and it just...worked. 

But here's the part I glossed over: Fargate isn't a service you deployed to. It's a **launch type**. When you ran that task, you had your first encounter with Amazon ECS — and you quietly accepted a bunch of defaults you didn't even know you were choosing.

So what *is* ECS, really?

<!-- truncate -->

:::info

This is Part 1 of a series exploring Amazon ECS from a Lambda developer's point of view. If you've read [AWS Lambda to AWS Fargate](https://blog.curiousdev.io/aws-lambda-to-fargate), you already have one foot in the door — this series is about understanding the room you walked into.

:::

In this post we'll look at what ECS actually is, why a happy Lambda developer would ever wander over here, and how the concepts map to things you already know. The rest of the series builds from there:

- **Part 2 — Three engines:** EC2, Fargate, and Managed Instances. Who owns the server?
- **Part 3 — Zero to running task:** deploy your first ECS service, hands-on.
- **Part 4 — Operational reality:** the networking and scaling Lambda hid from you.
- **Part 5 — Sidecars and daemons:** modifying how tasks behave, and finally *seeing* into them.
- **Part 6 — What does a task actually cost?** Fargate vs. EC2 vs. Managed Instances.
- **Part 7 — ECS, EKS, or Lambda?** Choosing your compute on purpose.

## Wait — I Was Using ECS the Whole Time?

Kind of, yes.

When you deployed that container to Fargate, something had to decide *where* it ran, *whether* it was healthy, and *what to do* when it fell over. That something is ECS. It's a container orchestrator. Fargate just answered one specific question for you — "whose server does this run on?" — and answered it with "not yours, don't worry about it."

That's a very Lambda answer. And if you liked that answer, good news: you can keep it. But now you can also *change* it.

Lambda hid the orchestrator completely. Fargate-on-ECS cracked the door open. ECS proper is what's on the other side of the door.

## What Lambda Was Doing For You (That ECS Now Hands Back)

Lambda's whole pitch is subtraction. You bring a function - AWS makes as many decisions as it possibly can on your behalf. Where does it run? Not your problem. How many copies? Scales automatically. Is it healthy? Replaced if not. How does traffic reach it? Wire up a trigger and move on.

ECS is more of a conversation. You bring a container, and ECS asks you questions Lambda never did:

- **Where should this run?** Fargate, your own EC2 instances, or Managed Instances.
- **How many copies do you want running, right now, always?** That's a number *you* pick.
- **How do I know a copy is healthy?** You define the health check.
- **How should traffic find them?** You put a load balancer in front.
- **When should I add or remove copies?** You configure the scaling rules.

None of this is harder in a scary way. It's just *visible* now. The autopilot you never thought about on Lambda is a set of switches on ECS — and most of the time, that's exactly why you came looking.

## The New Vocabulary, Mapped to What You Know

ECS introduces a handful of nouns. The fastest way to learn them is to hang each one on a Lambda concept you already carry around in your head.

- **Task definition** — the blueprint. It's your container image plus the config around it: CPU, memory, environment variables, IAM role, logging. Think of it as your function's configuration, written down and versioned.
- **Task** — a single running copy of that blueprint. The closest cousin to one concurrent Lambda execution — except it doesn't disappear the moment it finishes a request.
- **Service** — the thing that keeps your tasks running and healthy, replacing any that die. It holds you at a target count — and that count can be fixed, or one that ECS raises and lowers for you as load changes. This is what Lambda concurrency did automatically; the difference is that you own the policy instead of it being invisible.
- **Cluster** — the logical boundary your tasks and capacity live in. Mostly a container for the other things.
- **Launch type / capacity** — the answer to "whose server is this?" Fargate, EC2, or Managed Instances. This is the big one, and it gets its own post next.

:::tip

If you only memorize two words, make them **task definition** and **service**. The task definition is *what* runs; the service is *how many* keep running and *how* they stay healthy. Almost everything else in ECS attaches to one of those two.

:::

## So Why Would a Happy Lambda Developer Care?

Let me be clear up front, because it's the same thing I say about every "next" compute option: **don't go rewrite all your Lambda functions.** Lambda is still the right default for most event-driven work in AWS, and if you're just getting started, start there.

But you already know the edges of Lambda, because you've bumped into them:

- **The 15-minute wall.** Long-running or persistent processes don't fit. ECS tasks can run for as long as you like.
- **Steady-state cost.** Lambda bills beautifully for spiky, event-driven traffic. Run something busy around the clock and the math starts to wobble. (We'll do that math in Part 6.)
- **You want more control.** Specific CPU-to-memory ratios, a long-lived listener, a sidecar or daemon riding alongside your app — things Lambda's simplicity deliberately doesn't expose.

If you've felt any of those, ECS isn't a detour. It's the natural next room. And because you built your app with the container image and business logic already separated — you *did* do that, right? — walking in costs you a lot less than you'd think.

## The Real Win

This series isn't really about talking you out of Lambda. It's about the same thing that [migrating a Lambda to Fargate](https://blog.curiousdev.io/aws-lambda-to-fargate) was about: not painting yourself into a corner.

Every default Lambda picked for you was a decision — a good one, usually, made silently. ECS takes those same decisions and puts them in your hands. That's more responsibility, sure. It's also more options. And once you can see the switches, you get to choose deliberately instead of hoping the defaults keep fitting.

You already met ECS by accident. Time to get to know it on purpose.

Next up: **three engines — EC2, Fargate, and Managed Instances — and how to decide whose server your containers should run on.**

Stay curious! 🚀