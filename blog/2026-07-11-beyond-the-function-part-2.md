---
title: "One ECS, Three Engines: EC2, Fargate, and Managed Instances"
description: "Every ECS launch type runs the exact same container. The only thing that changes is who owns the server underneath — and that one question is the whole decision."
slug: one-ecs-three-engines
authors: [Brian]
tags: [aws, ecs, containers, fargate, ec2, managed-instances]
---

At the end of [the last post](https://blog.curiousdev.io/beyond-the-function-lambda-developer-discovers-ecs), I left you with the question ECS keeps asking that Lambda never did.

*Whose server is this?*

That question has exactly three answers. AWS calls them EC2, Fargate, and — the new kid — Managed Instances. Picking between them feels like the first real fork in your ECS journey, the one where you're sure you'll choose wrong and regret it for eighteen months.

Here's the reassuring part: it's less of a fork than it looks. All three run the *exact same container*. Same task definition, same image, same application code. The only thing that changes is who owns and babysits the box your container lands on. Get that one idea and the rest is just trade-offs.

<!-- truncate -->

<script async data-uid="2f82f140d9" src="https://curiousdev.kit.com/2f82f140d9/index.js"></script>

:::info

This is Part 2 of a series exploring Amazon ECS from a Lambda developer's point of view. In [Part 1](https://blog.curiousdev.io/beyond-the-function-lambda-developer-discovers-ecs) we established that ECS is the orchestrator Lambda hid from you. Now we're answering the very first question it asks back.

:::

## The Container Doesn't Care

Before we get into the three engines, let me prove the point that makes this whole decision low-stakes.

Your task definition has a single field that names which engines it's compatible with:

```jsonc
// Same image. Same app. One field says which engines it's allowed to run on.
"requiresCompatibilities": ["FARGATE"]           // serverless — no host in sight
"requiresCompatibilities": ["MANAGED_INSTANCES"] // AWS-run EC2, in your account
"requiresCompatibilities": ["EC2"]               // your own instances

// It's a list — a task definition can declare more than one:
"requiresCompatibilities": ["FARGATE", "MANAGED_INSTANCES"]
```

Note what that field is actually doing, because it's subtler than it looks: it declares which engines this task definition is *allowed* to run on. Something else — the capacity provider strategy on the service — decides where it actually lands. We'll wire that up in Part 3.

The point for now is that the container you built doesn't change either way. That's the thing to hold onto. You are not marrying an engine. You're choosing where to stand on a single slider: **maximum convenience on one end, maximum control on the other.** Let's walk it from left to right.

## Fargate: The One You've Already Met

If you've read [Lambda to Fargate](https://blog.curiousdev.io/aws-lambda-to-fargate), you know this one. Fargate is serverless containers. There is no host. You pick how much vCPU and memory each task gets, AWS runs it on infrastructure you will never see, log into, or patch, and you pay per task, per second.

For a developer coming from Lambda, this is the natural first step, and honestly it's where I'd tell most of you to start. It's the simplest thing that works, it shines for spiky or unpredictable traffic, and it keeps that "I don't own servers" feeling you came to love.

The catch is the flip side of the same coin. Because you never touch the host, you can't *have* opinions about the host. No custom AMIs. No GPUs. No privileged containers. No SSH. Fixed CPU/memory combinations rather than the full EC2 buffet. For a huge number of web services and workers, none of that matters. But the day you need a GPU for inference, or a specific instance family, or a beefier box than Fargate offers — Fargate quietly taps out.

:::tip

Rule of thumb: if you can't think of a reason you'd need to care about the underlying instance, you probably want Fargate. The absence of choices *is* the feature.

:::

## EC2: The One Where You Own Everything

Now jump to the far end of the slider.

With the EC2 launch type, *you* bring the instances. You run an Auto Scaling group of EC2 boxes, they register into your cluster, and ECS schedules tasks onto them. In exchange for that work, you get total control: any instance type, GPUs, custom AMIs, privileged containers, host networking, daemon tasks that run one-per-host, capacity reservations, aggressive bin-packing — the whole EC2 toolbox.

This is also the only engine where you customize **the box itself**. Launch templates and user data let you shape the host before a single container lands on it — bake your own AMI, install an agent, mount something exotic, tune a kernel parameter. That capability is precisely what you're buying with all the operational burden.

And the word "control" is doing a lot of quiet lifting in that sentence. Owning the instances means owning the instances. You patch the OS. You keep the ECS container agent current. You size the Auto Scaling group and make sure there's room for tasks to land. This is real operational surface area — the exact surface area Lambda spent years teaching you to forget existed.

So who's it for? People with a concrete reason to be here: specialized hardware, custom AMIs, privileged capabilities, capacity reservations, or a genuine need to control task placement down to the instance. If you can't name your reason, this probably isn't your engine yet.

## Managed Instances: The New Middle

Here's the one that didn't exist for most of your ECS mental model, and the reason this post needed writing.

For years, the choice was binary: Fargate's hands-off simplicity *or* EC2's flexibility, pick one. **Managed Instances is AWS trying to give you both.** The pitch: AWS provisions and fully manages real EC2 instances — running in *your* account — but you get out of the business of operating them.

Concretely, AWS handles provisioning, patching, scaling, and cost optimization of the instances, while you keep access to the full range of EC2 instance types and features.

And here's the distinction that makes this engine click:

> On Managed Instances, you customize **the instance selection**. On EC2, you customize **the box**.

You don't configure the host; you constrain the *choice* of host and let AWS make it. That happens on the capacity provider, through a set of instance requirements: you can name exact instance types or families, demand a CPU manufacturer (yes, including **Graviton**), or write attribute-based rules — "at least 8 vCPUs," "must have an accelerator," "SSD local storage only." Leave it alone and AWS just picks the most cost-optimized general-purpose instance that fits your tasks.

That's the headline, and it's the reason this engine exists: **you get Graviton and GPUs without ever running an Auto Scaling group.** If you've been eyeing Graviton's price-performance but weren't willing to take on a fleet of instances to get it, this is the path that was missing.

It's also genuinely clever about cost. It bin-packs multiple smaller tasks onto larger instances, consolidates workloads off instances that have gone idle, and right-sizes by launching replacement instances as your needs shift. And because these are real EC2 instances, any Savings Plans or Reserved Instances you already own apply automatically — no extra configuration.

So what's the catch? There's always a catch, and honesty about it is the whole reason you read this blog instead of the AWS marketing page:

- **It costs more than raw EC2.** You pay a management fee for the compute AWS provisions, *on top of* your normal EC2 charges. You're buying back your time; make sure the time is worth it.
- **No custom AMIs.** Managed Instances run AWS-managed, security-optimized images. If you depend on a bespoke AMI, this engine isn't for you.
- **No SSH.** Debug with ECS Exec instead. For a lot of teams that's fine — even preferable — but if your runbook starts with "SSH into the box," adjust your expectations.
- **Instances recycle every 14 days.** To stay patched and compliant, no instance lives longer than two weeks; AWS replaces them, and you can steer *when* using EC2 event windows. Your workloads need to tolerate hosts coming and going — which, if you've internalized "treat servers as cattle, not pets," they already should.

:::note

**Name collision, important:** this is *ECS* Managed Instances, which is not the same thing as [Lambda Managed Instances](https://blog.curiousdev.io/aws-lambda-managed-instances-part-1-overview). AWS rolled "Managed Instances" branding across more than one compute service in the same window. Same two words, different services, different docs. Don't let a search engine cross the wires on you.

:::

## A Quick Word On Capacity Providers

One technical wrinkle you'll trip over, so let me get ahead of it.

Lately AWS steers you toward **capacity providers** rather than the older launch-type field for deciding where tasks run. Fargate and EC2 can be driven either way. **Managed Instances is capacity-provider only** — there's no "just set the launch type and go" path; you attach a capacity provider strategy to the service. Mentally, a capacity provider is "a named pool of compute plus rules for how ECS draws from it" — and on Managed Instances, it's also where those instance requirements live.

Don't sweat the mechanics yet. We'll wire up a capacity provider for real in **Part 3**, and get into shaping what happens *inside* a task — sidecars, daemons, and the rest — in **Part 5**. For now, just know that when the console nudges you toward capacity providers instead of launch types, it isn't being difficult. It's the current recommended path.

## The Whole Decision On One Screen

Here's the comparison I wish I'd had when I started. Read it as a slider from convenience to control, left to right.

| | **Fargate** | **Managed Instances** | **EC2 (self-managed)** |
|---|---|---|---|
| **Who owns the host?** | AWS — invisible to you | AWS — but running in your account | You |
| **Who patches it?** | AWS | AWS (instances recycle every 14 days) | You |
| **Hardware flexibility** | Fixed sizes; no GPU | Full EC2 range: GPU, Graviton, families | Full EC2 range |
| **What you customize** | Nothing — that's the point | The **selection** (instance requirements) | The **box** (launch templates, user data, AMIs) |
| **Custom AMIs / privileged / SSH** | No | No (managed AMIs, ECS Exec only) | Yes |
| **What you pay for** | Per-task vCPU/mem, per second | EC2 cost **+ management fee** (SPs/RIs apply) | EC2 instances, whatever runs |
| **What you scale** | Task count | Task count (AWS handles the instances) | Task count **+** the Auto Scaling group |
| **Reach for it when…** | You want the simplest thing; spiky traffic; getting started | You need EC2's flexibility but not its ops burden | You need max control, custom AMIs, or reservations |

If your eye went straight to the middle column and thought "wait, that looks like the best of both" — yes, that's the pitch, and for a lot of workloads it's true. Just remember the management fee is the price of that convenience, and the cost post (Part 6) is where we'll put real numbers on whether it's worth it for your situation.

## When Not to Overthink This

A Lambda developer's honest decision tree is shorter than the table suggests:

- **Start on Fargate.** Really. It's the closest thing to the serverless experience you already trust, and most workloads never need to leave.
- **Move to Managed Instances when Fargate says no** — you need a GPU, Graviton, a bigger or more specific instance — but you don't want to babysit servers to get it. This is the "I've outgrown Fargate but I still don't want a pager" engine.
- **Drop to self-managed EC2 only when you can name the reason** — a custom AMI, privileged mode, capacity reservations, placement control. Real needs, not "just in case."

The wrong move is cargo-culting a big three-tier EC2 setup on day one because a conference talk told you to. Pick the most convenient engine that can actually run your workload, and slide toward control only when something forces you to.

## The Real Win

Go back to that little `requiresCompatibilities` snippet from the top. The reason this decision is low-stakes is that the engine is a *property of where you run*, not of *what you built*. Your container doesn't know or care which of the three it lands on. That means you can start on Fargate, discover you need a GPU eighteen months from now, and move to Managed Instances without rewriting your application — you're changing the ground under the task, not the task.

That's the same theme running through this whole series. Lambda made one choice for you and hid it. ECS hands you the slider and says *you pick — and change your mind later if you want*. Three engines isn't three commitments. It's one dial you're allowed to turn.

Next up: enough theory — we're going to **take a container from zero to a running ECS service**, wire up that capacity provider I keep teasing, and actually watch a task come alive.

Stay curious! 🚀
