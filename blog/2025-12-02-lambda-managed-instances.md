---
slug: aws-lambda-managed-instances-part-1-overview
title: Introducing AWS Lambda Managed Instances (Part 1 - Overview)
authors: [Brian]
tags: [aws, lambda, managed-instances]
---

You've optimized your Lambda functions six ways from Sunday, but costs are still eating your budget. AWS LMI might help.

<!--truncate-->

<script async data-uid="2f82f140d9" src="https://curiousdev.kit.com/2f82f140d9/index.js"></script>

AWS announced the release of [AWS LMI](https://aws.amazon.com/blogs/aws/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/) on the Sunday before re:Invent 2025.

What changes with this new option?

The operational model stays familiar - functions are still triggered by events - but the configuration complexity increases significantly.

In this post we'll look at what AWS LMI is and how you should consider it as a tool in your serverless toolbelt. [Part 2](/aws-lambda-managed-instances-part-2-cost) will cover cost-analysis. Part 3 will look at specific runtime considerations when using AWS LMI.

## What is AWS LMI?

AWS LMI allow developers to be a bit more opinionated about how functions run than what I'll call on-demand Lambda. On-demand Lambda provides switches to let developers, among other things, influence concurrency, configure RAM, and specify how much ephemeral storage to associate with functions. Yes, there are other configuration settings, but really, the goal of Lambda is to minimize the number of choices a developer must make in order to build and deploy their functions.

AWS LMI exposes a few more switches to control how their functions behave. The elevator pitch of AWS LMI is that developers get more instance flexibility and concurrency efficiency while still having AWS manage the underlying compute.

## What Changes with AWS LMI?

AWS LMI forces developers to make more choices. It's no longer just about specifying RAM or concurrency controls. Now, you need create and configure a [capacity provider](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-capacity-providers.html).

What's a capacity provider?

Basically it's a construct you need to use in order to specify things like your VPC configuration, IAM role for managing EC2 instances, instance requirements, and scaling configuration. These are the additional switches you need to configure when using AWS LMI. There are defaults for instance requirements and scaling requirements.

Want to enforce a CPU architecture? Want to specify instance types for your functions? Want to _exclude_ instance types for your functions? Capacity providers let you do that.

Want to control how Lambda scales your instances when the time comes? Capacity providers let you manage that, too.

Remember that you'll also need to create and manage a AWS Virtual Private Cloud (AWS VPC) in order to use AWS LMI. These instances are now running in _your_ AWS account, not a AWS managed one. Your networking requirements will get more complex if you haven't already VPC-enabled your on-demand functions. 

## When Would You Actually Use It?

Should you go out and switch all of your on-demand Lambda functions to run on AWS LMI?

The short answer is **NO**! 

![Cat pressing red button](https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTk2YWpxYW55bHg3MDY4ZTh4a2Y2ZDlseDA5d3pyYTU2Y2F5OXVzMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/FpxOAPDeyE6NvSX7hz/giphy.gif)

AWS LMI is really great in some - but not all - scenarios. If you're just getting started with AWS Lambda then I _really_ think you should use on-demand. Test your assumptions, but here are several workload types AWS considers really well suited for AWS LMI.

* **High volume, predictable workloads** - AWS LMI is really well suited to steady-state workloads that don't have unexpected spikes. Yes, the underlying instances can scale up but EC2 instances scale much slower than on-demand execution environments. What does high volume really mean? Stay tuned for subsequent posts where I'll look at the break-even point of AWS LMI versus on-demand Lambda.

* **Performance-critical applications** - Access to latest CPUs, varying memory-CPU ratios, and high network throughput. On-demand Lambda performance tuning is simple - you can adjust the amount of allocated RAM and your CPU will scale linearly. AWS LMI and their capacity providers specify instances based on their CPU or RAM availability. You can also tweak your memory to vCPU.

* **Regulatory requirements** - Granular governance needs with control over VPC and instance placement. Need to route network traffic for inspection? 

I think most Lambda operators using AWS LMI should really, really focus on the first point. AWS LMI is well suited to handling steady state workloads. By default, Lambda will maintain enough headroom on your instances to accommodate 2x traffic growth within 5 minutes, but if you have spikey workloads you'll need to plan ahead. Operators can configure [capacity providers](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-capacity-providers.html) to control scaling configurations. You think cold-starts are bad in on-demand functions? Just wait until your function needs to scale beyond instance bounds. Think minutes, not milliseconds.

## The Real Win

I see AWS LMI as an optimization of the existing on-demand Lambda experience. AWS LMI runs on EC2 instances under the hood, making your existing EC2 Savings Plans applicable in ways they never were with on-demand Lambda. You can likely lower costs for the right workloads. You can also have more control over function performance characteristics.

In the same breath I also say caveat emptor - make sure AWS LMI is right for your use cases. Test those assumptions and, if you're just getting started with AWS Lambda, please use on-demand rather than AWS LMI.

In future posts I'll dig deeper into AWS LMI. This post is an introduction to the feature - there is _so_ much more to unpack.

Stay curious! 🚀
