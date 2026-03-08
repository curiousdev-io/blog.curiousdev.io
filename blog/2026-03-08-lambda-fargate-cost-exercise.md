---
slug: aws-lambda-fargate-cost-exercise
title: AWS Lambda and AWS Fargate Cost Exercise
authors: [Brian]
tags: [aws, lambda, fargate, cost]
---

import LambdaFargateCostExercise from '@site/src/components/LambdaFargateCostExercise';

You might be considering whether to deploy your application to a serverless service. Maybe you're an AWS customer weighing AWS Lambda (serverless functions) against AWS Fargate for Amazon ECS (serverless containers).

Your application fits within Lambda's hard constraints — 15-minute max duration, package size, payload limits, memory, and cold start latency all check out.

Is Lambda a good fit? Is it better to run on AWS Fargate?

It's an important question, especially in organizations that deploy a lot of resources to AWS. In this post, we'll work through that question with a focus on cost — and we'll cover a technique you can use to minimize the risk of getting the answer wrong.

<!--truncate-->

## The Compute Options

### AWS Lambda

[AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) is a serverless compute service that runs your programs in response to events. These events can come from a large - and growing - number of sources in the AWS ecosystem. The primary value of Lambda centers on a few key principles:

* **No server management:** Installing, maintaining, and decommissioning servers are AWS's responsibility, not yours. Yes, there are servers in serverless. You just don't need to manage them.

* **Automatic scaling:** AWS Lambda scales with demand. Load increases? Lambda scales up. No traffic? Lambda scales down to zero. [Read the fine print](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html) - there are concurrency limits and burst ceilings worth understanding, but the fundamentals hold. 

* **Tie cost to business value:** Functions are only invoked when your application is in use. You pay when there's associated business value — not before.

* **Built-in resiliency:** AWS ensures your functions can operate across multiple Availability Zones. Need VPC access? Configure your function with multiple subnet associations and AWS handles the rest.

### AWS Fargate for Amazon ECS

[AWS Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) is a serverless container service that you can use without 
having to manage servers or clusters of virtual machines. You specify your CPU and memory requirements, define networking and IAM policies, and you're off and running. You'll realize many of the same benefits as AWS Lambda _except one_.

**AWS Fargate tasks are always on.** The meter runs regardless of whether your application is in use.

## Considering Cost

If your application falls within the constraints of _both_ AWS Lambda and AWS Fargate, cost becomes a natural differentiator. I'd encourage you to think carefully about what "cost" actually means here.

### Cloud Cost vs Total Cost

AWS provides a handy [pricing calculator](https://calculator.aws/#/) for estimating cloud resource costs. What many people discover is that at a certain usage threshold, Lambda cloud costs exceed Fargate cloud costs. There is a real inflection point: "always on" can be cheaper than "on when needed" once request volume is high enough.

For a typical web API — say, 128MB memory, 200ms average duration — that crossover often occurs somewhere around a few million requests per day, depending on your configuration. The calculator below will help you find your specific number.
But the AWS Pricing Calculator can't give you the full picture.

Why not? Because AWS doesn't know how many engineers it takes to support your application — and those hours aren't free.

AWS created a whitepaper with Deloitte Consulting — [Determining the Total Cost of Ownership of Serverless Technologies when compared to Traditional Cloud (September 2019 v2)](https://pages.awscloud.com/rs/112-TZM-766/images/AWS_MAD_Deloitte_TCO_paper.pdf) — to frame that conversation. The specific figures are dated, but the methodology is sound: total cost blends both cloud spend and the engineering hours required to build, operate, and maintain applications.

To make this concrete: imagine a team spending just 3 extra hours per month managing Fargate task definitions, capacity planning, and deployment config — work that Lambda handles automatically. At a blended engineering rate of $150/hr, that's $450/month before you count a single AWS dollar. Depending on your request volume, that labor cost alone may flip the break-even calculation.

It's critical to account for TCO when evaluating compute options.

## Cost Calculator

I built a calculator to help developers understand both cloud costs and engineering costs side by side. Use it to anchor data-driven conversations about compute decisions. Key inputs that drive the break-even point include request volume, average function duration, memory allocation, and engineering hours per month. Pricing values are current as of February 2026 — your mileage may vary as AWS adjusts rates.

<LambdaFargateCostExercise />

## Mitigating Risk

The calculator helps you find the right answer today. But what if your assumptions are wrong tomorrow?

Maybe your app gets featured on [Wired](https://www.wired.com/) and traffic spikes 10x overnight. Maybe you're building for a use case that takes longer to gain traction than expected. Circumstances change — and locking yourself into a compute model that's hard to exit is its own form of cost.

The good news: you can reduce that switching cost significantly by treating compute as an implementation detail from the start.

* **Package as OCI containers:** Both Lambda and Fargate support container images. If you build your functions as OCI-compliant images from day one, migrating between them is mostly a matter of updating your task or function configuration — not rearchitecting your application.

* **Keep business logic decoupled from runtime specifics:** Avoid embedding Lambda-isms (like direct use of context or trigger-specific payload parsing) deep in your core logic. Thin handler wrappers and clean interfaces let you swap the runtime without touching the application layer.

* **Write for portability, not just convenience:** The slightly higher upfront discipline pays dividends if you ever need to move.

I have a [separate blog post](/aws-lambda-to-fargate) that goes into more detail, including deployable code examples.

## Now what?

If you're architecting a new application — or reviewing an existing one — cost will certainly factor into the decision. The key takeaway: don't evaluate Lambda vs. Fargate on cloud spend alone. Factor in the engineers building and maintaining your applications. That human cost is often enough to shift the break-even point in Lambda's favor, even when raw cloud costs suggest otherwise.

Run your numbers in the calculator above and let the data drive the conversation.

Stay curious! 🚀