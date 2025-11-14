---
slug: aws-lambda-container-images-part-3-custom-image-for-lambda
title: AWS Lambda Container Images (Part 3 - Custom Images for Lambda)
authors: [Brian]
tags: [aws, lambda, container]
---

You're a Docker pro - or you work in an environment that already has a well defined pipeline for building out containers. Let's look at how to incorporate custom images into your AWS Lambda workflows.
<!--truncate-->

📦 Code Along: This post references a complete working example on [GitHub](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main). Clone it to follow along hands-on. There are Go and Python examples.

## Brief Review

In my previous posts, I went over the benefits of packaging AWS Lambda functions in container and demonstrated how to use container images provided by AWS. Didn't read them? Don't worry - here are the links to [Part 1](/aws-lambda-container-images-part-1-aws-base-image-for-lambda) and [Part 2](/aws-lambda-container-images-part-2-aws-os-only-image-for-lambda) of the series.

## What's So Different This Time Around?

This post is a bit of a departure from the previous two posts. They focused on using container images provided by AWS. This one shows _how_ to build out a Lambda function using your own container image. Before we do, we'll explore _why_ you might want to go this route rather than use AWS-provided images.

## Why Bother Building Your Own AWS Lambda Container Image?

Why might we want to go this route when AWS already provides language-specific and OS-only images?

Control.

You may be a seasoned container developer who knows all the ins-and-outs of a Dockerfile and have optimized your workflow to quickly and reliably build containerized applications. Such control means you have the ability to specify what goes into and what stays out of your container image. There are two potential benefits - container size and security.

Your container size influences your function initialization time (i.e. cold start). You'll find a correlation between the number of bits and bytes the AWS Lambda service needs to shuffle around the length of your cold start. By taking control of your container image you can exclude things that aren't necessary to run your function. You likely won't need a full-blown operating system - why package your image like you'll need one? You can be surgical and **only** include what your function needs to run. You may also have an employer who has opinions (ok...requirements) about what should be included in and excluded from container images. You can reuse these images in AWS Lambda. 

The second potential benefit worth exploring is your security exposure. Remember - every package you include in an image is an potential attack vector. You have full control of what is included when packaging your own images. You can base container images that are designed to be minimal. [Chainguard](https://www.chainguard.dev/) follows the principle of distroless and has a number of container images available. [Google](https://github.com/GoogleContainerTools/distroless) also has a number of distroless container images.

## How to Build Custom Lambda Images

Now that we've gotten the question of "why use custom Lambda images?" addressed, let's move to the question of _how_ to build out custom Lambda images.

There are really only a handful of items that need to be included in a container image to make it compatible with AWS Lambda. We'll look at the first - the **Runtime Interface Client (RIC)** - before moving on to the **Runtime Interface Emulator (RIE)**.

### Runtime Interface Client (RIC)

The RIC is a [set of software packages that implement the Lambda Runtime API](https://github.com/aws/aws-lambda-python-runtime-interface-client). It's the magic that allows your runtime to receive data from (i.e. events) and send data back to the the AWS Lambda service.

The RIC is packaged by default in AWS provided base images (e.g. [python](https://gallery.ecr.aws/lambda/python), [node.js](https://gallery.ecr.aws/lambda/nodejs)). There is nothing special you need to do during the build process when you use these images. However, when you're building your own image, you'll need to include it.

The [Go example](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main/custom-images/go) uses the [aws/aws-lambda-go module](https://pkg.go.dev/github.com/aws/aws-lambda-go/lambda) module. The good news is that it already includes the RIC so there's really nothing special you need to do. The `lambda.Start()` function **is** the RIC for Go Lambda functions. The [Python example](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main/custom-images/python) is a little bit different. I install the [awslambdaric](https://github.com/aws/aws-lambda-python-runtime-interface-client) package during the build stage.

**Python Dockerfile**

```bash
...
# --- Build stage ---
FROM cgr.dev/chainguard/python:latest-dev AS builder

ARG LAMBDA_TASK_ROOT
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --target ./packages -r requirements.txt && \
    pip install --target ./packages awslambdaric
...
```

Technically, this is all you need to have present in your Lambda image for it to work with the AWS Lambda service. However, like any good software developer, you'll want to build and test your application before deploying it to AWS. Let's review how to make that happen.

### Runtime Interface Emulator (RIE)

The RIE is a proxy for Lambda's Runtime and Extensions API. It is a lightweight web-server that converts HTTP requests to JSON events and maintains functional parity with the Lambda Runtime API in the cloud. Basically, it's what allows you to build and run your AWS Lambda functions locally.

In my Go and Python examples, I built wrapper scripts to detect whether the `AWS_LAMBDA_RUNTIME_API` variable has a value or not. If it doesn't, it means the function is not running in AWS so the function handler needs to be wrapped by the RIE. The approach I took differed slightly because of the base container I was building from.

### Python

The Python example's [Dockerfile](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/custom-images/python/Dockerfile) uses a multi-stage build where separate [Chainguard](https://www.chainguard.dev/) images were used. 

The RIE is downloaded during the build stage. In this example, I'm downloading it directly from Github.

```bash
...
# --- Build stage ---
FROM cgr.dev/chainguard/python:latest-dev AS builder
...
...
# Download RIE to a writable location and set permissions
USER root
ADD --chmod=755 https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /app/aws-lambda-rie

# Create entrypoint script in build stage
COPY --chmod=755 entry.py /app/entry.py
...
```

I use a Python script [entry.py](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/custom-images/python/entry.py) in the runtime stage that determines whether the function is running in the AWS cloud or not. If so, it executes the Lambda handler directly. If not, it wraps the handler with the RIE.

```bash
# --- Runtime stage ---
FROM cgr.dev/chainguard/python:latest AS runtime

...
COPY --from=builder /app/aws-lambda-rie /usr/local/bin/aws-lambda-rie
COPY --from=builder /app/entry.py /entry.py

ENTRYPOINT ["python", "/entry.py"]
CMD ["lambda_function.handler"]
```

**NOTE**: I used a Python script because the Chainguard Python dev image does not have a shell.

### Go

There is a lot of reuse in the Go example's [Dockerfile](). I use a multi-stage build with two separate images. 

The RIE is downloaded directly from Github in the build stage.

```bash
# --- Build stage ---
FROM golang:1.25-alpine AS build
...
...
# Download RIE for local testing
ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /tmp/aws-lambda-rie
RUN chmod +x /tmp/aws-lambda-rie
```

I use a bash script [entry.sh](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/custom-images/go/entry.sh) in the runtime stage that determines whether the function is running in the AWS cloud or not. If so, it executes the Lambda handler directly. If not, it wraps the handler with the RIE.

```bash
# --- Runtime stage ---
FROM alpine:3.22 AS runtime

...
...
COPY --from=build /tmp/aws-lambda-rie /usr/local/bin/aws-lambda-rie
COPY --from=build /tmp/entry.sh /entry.sh
RUN chmod +x /usr/local/bin/aws-lambda-rie
RUN chmod +x bootstrap
RUN chmod +x /entry.sh
CMD ["/entry.sh"]
```

**NOTE:** In this case, the alpine runtime image has a shell that can be used.

The steps to actually build and deploy the Go and Python functions are laid out in the [supporting Gihub repo curiousdev-io/aws-lambda-container-images](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main/custom-images). I won't repeat the steps here.

## Things to Note

In my example, I chose to build on minimalist images (Chainguard, Alpine). The size of the images is **remarkable**, especially when compared with the AWS-provided and AWS OS-only images.

| Language | AWS Base Image | AWS OS-only Image | Custom Image |
|:--------:|:-----------:|:----:|:----:|
| Go | n/a | 42.40 MB | 11 MB |
| Python | 185 MB | n/a | 40.86 MB|

Consider building out your own custom images when there is a need for tighter control of container contents. A really nice likely side effect will be slimmer images.

## Next Steps

In the first three parts of this series, we've looked at different ways to package up AWS Lambda functions as containers. In my next post, I'm going to try something out...

Something new for me...

I'm going to document the effort required to take a containerized Lambda function and get it to run in [AWS Fargate](https://aws.amazon.com/fargate/) - AWS' serverless container service!

Will it work? Let's find out.

Stay curious! 🚀
