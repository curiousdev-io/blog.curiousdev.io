---
slug: aws-lambda-container-images-part-3-custom-image-for-lambda
title: AWS Lambda Container Images (Part 3 - Custom Images for Lambda)
authors: [Brian]
tags: [aws, lambda, container]
---

You're a Docker pro - or maybe you just work somewhere with strong opinions about how containers should be built. Either way, let's talk about bringing your own container images to AWS Lambda.
<!--truncate-->

📦 Code Along: This post references a complete working example on [GitHub](https://github.com/curiousdev-io/aws-lambda-container-images/tree/main). Clone it to follow along hands-on. There are Go and Python examples.

## Brief Review

In my previous posts, I went over the benefits of packaging AWS Lambda functions in container and demonstrated how to use container images provided by AWS. Didn't read them? Don't worry - here are the links to [Part 1](/aws-lambda-container-images-part-1-aws-base-image-for-lambda) and [Part 2](/aws-lambda-container-images-part-2-aws-os-only-image-for-lambda) of the series.

## What's So Different This Time Around?

This post is a bit of a departure from the previous two posts. They focused on using container images provided by AWS. This one shows _how_ to build out a Lambda function using your own container image. Before we do, we'll explore _why_ you might want to go this route rather than use AWS-provided images.

## Why Bother Building Your Own AWS Lambda Container Image?

Look, AWS already gives us language-specific and OS-only images. So why would you want to roll your own?

One word: **Control**.

Maybe you're a container ninja who's spent years perfecting your Dockerfile game. Or maybe your security team has _very specific ideas_ (read: requirements) about what belongs in a container image and what doesn't. There are two potential benefits to using custom images - container size and security.

Your container size influences your function initialization time (i.e. cold start). You'll find a correlation between the number of bits and bytes the AWS Lambda service needs to shuffle around and the length of your cold start. By taking control of your container image you can exclude things that aren't necessary to run your function. You likely won't need a full-blown operating system - why package your image like you'll need one? You can be surgical and **only** include what your function needs to run. You may also have an employer who has opinions (ok...requirements) about what should be included in and excluded from container images. You can reuse these images in AWS Lambda. 

The second potential benefit worth exploring is your security exposure. Remember - every package you include in an image is an potential attack vector. You have full control of what is included when packaging your own images. You can base container images that are designed to be minimal. [Chainguard](https://www.chainguard.dev/) follows the principle of distroless and has a number of container images available. [Google](https://github.com/GoogleContainerTools/distroless) also has a number of distroless container images.

## How to Build Custom Lambda Images

Now that we've gotten the question of "why use custom Lambda images?" addressed, let's move to the question of _how_ to build out custom Lambda images.

There are really only a handful of items that need to be included in a container image to make it compatible with AWS Lambda. We'll look at the first - the **Runtime Interface Client (RIC)** - before moving on to the **Runtime Interface Emulator (RIE)**.

### Runtime Interface Client (RIC)

The [RIC](https://github.com/aws/aws-lambda-python-runtime-interface-client) is basically the secret sauce that lets your code talk to the Lambda service. It's what allows your runtime to receive data from (i.e. events) and send data back to the the AWS Lambda service.

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

Technically, you could stop here and your Lambda image would work with the AWS Lambda service. However, like any good software developer, you'll want to build and test your application locally before deploying it to AWS. Let's review how to make that happen.

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

There is a lot of reuse in the Go example's [Dockerfile](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/custom-images/go/Dockerfile). I use a multi-stage build with two separate images. 

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

## Local Experience

We can locally invoke our Lambda functions now that the RIE is included in each of our repective container images.

The `mise` task [local-build-and-invoke](https://github.com/curiousdev-io/aws-lambda-container-images/blob/main/custom-images/go/.config/mise/tasks/local-build-and-invoke) is just a wrapper to build the Docker image and start up my custom container using Docker.

```bash
✗ mise run local-build-and-invoke
[local-build-and-invoke] $ ~/code/curiousdev-io/aws-lambda-container-images/custom-images/go/.config/mi…
[create-image] $ ~/code/curiousdev-io/aws-lambda-container-images/custom-images/go/.config/mise/tasks/c…
[*] Creating image...
[+] Building 0.4s (27/27) FINISHED                                                 docker:desktop-linux
 => [internal] load build definition from Dockerfile                                               0.0s
 => => transferring dockerfile: 987B                                                               0.0s
 => [internal] load metadata for docker.io/library/alpine:3.22                                     0.2s
 => [internal] load metadata for docker.io/library/golang:1.25-alpine                              0.2s
 => [internal] load .dockerignore                                                                  0.0s
 => => transferring context: 2B                                                                    0.0s
 => [build  1/12] FROM docker.io/library/golang:1.25-alpine@sha256:d3f0cf7723f3429e3f9ed846243970  0.0s
 => => resolve docker.io/library/golang:1.25-alpine@sha256:d3f0cf7723f3429e3f9ed846243970b20a2de7  0.0s
 => [internal] load build context                                                                  0.0s
 => => transferring context: 409B                                                                  0.0s
 => [runtime 1/8] FROM docker.io/library/alpine:3.22@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be50  0.0s
 => => resolve docker.io/library/alpine:3.22@sha256:4b7ce07002c69e8f3d704a9c5d6fd3053be500b7f1c69  0.0s
 => [build  9/12] ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/lates  0.2s
 => CACHED [runtime 2/8] WORKDIR /var/task                                                         0.0s
 => CACHED [build  2/12] WORKDIR /src                                                              0.0s
 => CACHED [build  3/12] COPY go.mod go.sum ./                                                     0.0s
 => CACHED [build  4/12] RUN go mod download                                                       0.0s
 => CACHED [build  5/12] COPY internal/ ./internal/                                                0.0s
 => CACHED [build  6/12] COPY cmd/ ./cmd/                                                          0.0s
 => CACHED [build  7/12] RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-w -s" -o b  0.0s
 => CACHED [build  8/12] RUN chmod +x bootstrap                                                    0.0s
 => CACHED [build  9/12] ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/release  0.0s
 => CACHED [build 10/12] RUN chmod +x /tmp/aws-lambda-rie                                          0.0s
 => CACHED [build 11/12] COPY entry.sh /tmp/entry.sh                                               0.0s
 => CACHED [build 12/12] RUN chmod +x /tmp/entry.sh                                                0.0s
 => CACHED [runtime 3/8] COPY --from=build /src/bootstrap /var/task                                0.0s
 => CACHED [runtime 4/8] COPY --from=build /tmp/aws-lambda-rie /usr/local/bin/aws-lambda-rie       0.0s
 => CACHED [runtime 5/8] COPY --from=build /tmp/entry.sh /entry.sh                                 0.0s
 => CACHED [runtime 6/8] RUN chmod +x /usr/local/bin/aws-lambda-rie                                0.0s
 => CACHED [runtime 7/8] RUN chmod +x bootstrap                                                    0.0s
 => CACHED [runtime 8/8] RUN chmod +x /entry.sh                                                    0.0s
 => exporting to image                                                                             0.0s
 => => exporting layers                                                                            0.0s
 => => exporting manifest sha256:19d2e0d77d765c2804100083b7c0ba5da5b2e5890b289f0000423d1404af5b7f  0.0s
 => => exporting config sha256:1836c5cfba3726a95943c20610b0fce5229def66ecf3b3d88ac708d7a3eff2a4    0.0s
 => => naming to docker.io/curiousdev-io/custom-go:1.25                                            0.0s
 => => unpacking to docker.io/curiousdev-io/custom-go:1.25                                         0.0s
[*] Docker image built successfully.
[local-invoke] $ ~/code/curiousdev-io/aws-lambda-container-images/custom-images/go/.config/mise/tasks/l…
[*] Starting a local instance of the function
[*] Starting a new local instance on port 9000
14 Nov 2025 15:55:46,908 [INFO] (rapid) exec '/var/task/bootstrap' (cwd=/var/task, handler=)
[*] Invoking the function locally with /hello?name=Chris
14 Nov 2025 15:55:49,792 [INFO] (rapid) INIT START(type: on-demand, phase: init)
14 Nov 2025 15:55:49,794 [INFO] (rapid) The extension's directory "/opt/extensions" does not exist, assuming no extensions to be loaded.
START RequestId: e429f482-bf29-4506-b5f1-f0dd1f77a69d Version: $LATEST
14 Nov 2025 15:55:49,796 [INFO] (rapid) Starting runtime without AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN , Expected?: false
14 Nov 2025 15:55:49,817 [INFO] (rapid) INIT RTDONE(status: success)
14 Nov 2025 15:55:49,817 [INFO] (rapid) INIT REPORT(durationMs: 25.252000)
14 Nov 2025 15:55:49,818 [INFO] (rapid) INVOKE START(requestId: b7816723-df27-414d-89aa-2cbd4514f37f)
2025/11/14 15:55:49 INFO Lambda handler invoked path=/hello method=GET
{"time":"2025-11-14T15:55:49.821160385Z","level":"INFO","msg":"request processed","path":"/hello","query":{"name":"Chris"},"status":200,"message":"Hello, Chris"}
14 Nov 2025 15:55:49,824 [INFO] (rapid) INVOKE RTDONE(status: success, produced bytes: 0, duration: 5.873000ms)
END RequestId: b7816723-df27-414d-89aa-2cbd4514f37f
REPORT RequestId: b7816723-df27-414d-89aa-2cbd4514f37f  Init Duration: 0.51 ms  Duration: 32.39 ms     Billed Duration: 33 ms   Memory Size: 3008 MB    Max Memory Used: 3008 MB
{"statusCode":200,"headers":{"Content-Type":"application/json"},"multiValueHeaders":null,"body":"{\"timestamp\":\"2025-11-14T15:55:49Z\",\"status\":200,\"message\":\"Hello, Chris\"}","cookies":null}
[*] Local invocation completed successfully.
```

## Things to Note

In my example, I chose to build on minimalist images (Chainguard, Alpine). The size of the images is **remarkable**, especially when compared with the AWS-provided and AWS OS-only images.

| Language | AWS Base Image | AWS OS-only Image | Custom Image |
|:--------:|:-----------:|:----:|:----:|
| Go | n/a | 42.40 MB | 11 MB |
| Python | 185 MB | n/a | 40.86 MB|

Yeah, you read that right - 11 MB for Go. That's not a typo. 🎯

Consider building out your own custom images when there is a need for tighter control of container contents. A really nice likely side effect will be slimmer images.

## Next Steps

In the first three parts of this series, we've looked at different ways to package up AWS Lambda functions as containers. In my next post, I'm going to try something out...

Something new for me...

I'm going to document the effort required to take a containerized Lambda function and get it to run in [AWS Fargate](https://aws.amazon.com/fargate/) - AWS' serverless container service!

Will it work? Let's find out.

Stay curious! 🚀
