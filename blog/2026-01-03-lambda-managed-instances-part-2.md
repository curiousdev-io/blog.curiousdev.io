---
slug: aws-lambda-managed-instances-part-2-cost
title: AWS Lambda Managed Instances (Part 2 - Cost)
authors: [Brian]
tags: [aws, lambda, managed-instances]
---

import LambdaCostComparison from '@site/src/components/LambdaManagedInstancesCostComparison';


You've likely seen the [AWS launch post](https://aws.amazon.com/blogs/aws/introducing-aws-lambda-managed-instances-serverless-simplicity-with-ec2-flexibility/) and are intrigued by what AWS Lambda Managed Instances (AWS LMI) can offer. You may have even read my overview of AWS LMI in an [earlier blog post](/aws-lambda-managed-instances-part-1-overview). 

In this post, we'll look at AWS Lambda On-Demand costs, how costs change with AWS LMI, when it makes sense to use AWS LMI and when it makes sense to stick with On-Demand AWS Lambda.

<!--truncate-->

<script async data-uid="2f82f140d9" src="https://curiousdev.kit.com/2f82f140d9/index.js"></script>

## How Are AWS Lambda On-Demand Costs Calculated?

Lambda costs are not always easy to understand. Despite having a serverless operating model there are a few things to consider that influence cost. 

At their core, Lambda costs represent the product of how many invocations were made, how much memory was allocated, and how long the functions ran (GB-per-month). Typically ARM CPU architectures are less expensive than x86.

**Number of Invocations X GB-per-month**

Asynchronous Event Sources like S3, SNS, EventBridge, StepFunctions, Cloudwatch Logs incur 1 invocation for the first 256KB chunk of payload and an additional 1 invocation per additional 64KB chunk.

Keep in mind there are other things that affect cost:

* **Provisioned Concurrency (PC)** keeps a specified number of execution environments up and available as a way to minimize initialization time (i.e. cold starts). Keeping these execution environments up and available has a cost associated with it.

* **Ephemeral Storage** costs are incurred when you allocate more than 512MB to your function. You pay for the difference between what you allocate and 512MB. There is a fraction of a penny charge per invocation for the amount of storage allocated to your function (GB-per-second).

* **Data Transfer** costs can come up if your function is configured to use a VPC. Even if you're not using a VPC you may incur costs based upon what you're interacting with. Target AWS services may have their own data transfer pricing considerations.

## How Does the Cost Discussion Change with AWS LMI?

This is where things get a bit more interesting - and possibly more complex.

There is an uptime component to AWS LMI just like there is for Provisioned Concurrency. You're paying to have capacity available to you. You will need to specify the **instance type**.

Because you have an entire instance (or several instances, based on your Capacity Provider configuration), you do not pay for GB-per-second. Instead, you pay for request charges, EC2 instance uptime charges, and an AWS management fee. The good news is the request charges for AWS LMI are the same as On-Demand Lambda ($0.20 per 1M requests). You can reduce EC2 instance costs by using Compute Savings Plans, Reserved Instances, or other EC2 pricing options but now you're dipping your toes into the world of _instance capacity planning_. 

Rather than just considering things like allocated RAM, duration, and the number of invocations, you're going to need to consider your [capacity provider](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-capacity-providers.html) configuration. What types of instances are optimal for your workload?

## Interactive Cost Calculator

I've created an interactive cost calculator to make it easier to visualize when it might make sense to consider AWS LMI and when it might make sense to stick with On-Demand Lambda.

Full disclosure - and for anyone who knows me this should come as no surprise - I created the cost calculator using [Claude Code](https://claude.com/product/claude-code). I ran through several scenarios to evaluate On-Demand and AWS LMI pricing using the [AWS Pricing Calculator with AWS Lambda](https://calculator.aws/#/createCalculator/Lambda).

This cost calculator is meant to be directional. It's not intended to be used to make business decisions. Be sure to test your assumptions - don't just rely on my interactive cost calculator.

<LambdaCostComparison />

## Now What?

AWS LMI is a nice addition to the serverless compute toolbelt for AWS customers. It offers customers who run steady state, high volume Lambda functions a mechanism to save a substantial amount of money.

Critically evaluate whether AWS LMI is the right option or whether you should stick with On-Demand AWS Lambda. If you're just getting started, I'd encourage you to stick with On-Demand until you have more data to inform a jump to AWS LMI.

As a rule of thumb, I'd only consider AWS LMI once your steady-state function hits 5 million invocations per month. I'd also only consider it appropriate for functions that are configured with 2GB or more. It's a current limit (as of January 2026) so check the [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-managed-instances-scaling.html#lambda-managed-instances-adjusting-scaling) over time.

Stay curious! 🚀
