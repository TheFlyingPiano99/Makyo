#version 420 core
out vec4 NormalHeightOut;

in vec2 texCoords;
in vec4 w_rayDir;

uniform float wMirrorDepth;
uniform float wMirrorBackgroundConvexity;
uniform float wMirrorBackgroundRadius;
uniform float wMirrorCurvatureRadius;
uniform vec2 wMirrorSize; // Should be (1, 1)
uniform float mirrorConvexity;
uniform float wShapeOutlineWidth;
uniform float wCarvRadius;
uniform float carvConvexity;
uniform int lineMode;   // 0 ... step, 1 ... carving, 2 ... flat obj
uniform float _sx0;
uniform float _sx1;
uniform float _sx2;
uniform float _sx3;
uniform float _sy0;
uniform float _sy1;
uniform float _sy2;
uniform float _sy3;

uniform sampler2D mirror;

float m_pi = 3.141592653589793;

/*
    Returns height and derivative of height
*/
vec2 curvature(vec2 uv, int direction, float s0, float s1, float r, float convexity) {
    float widthSquared = pow(wMirrorSize[direction], 2);
    return convexity * vec2(
        sqrt(pow(r, 2) - widthSquared * pow(uv[direction] - (s0 + s1) / 2.0, 2)) - sqrt(pow(r, 2) - widthSquared * pow((s1 - s0) / 2.0, 2)),

        widthSquared * ((s0 + s1) / 2.0 - uv[direction]) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv[direction] - (s0 + s1) / 2.0, 2))
    );
}

/*
 Returns height, derivative of height by u and by v
*/
vec3 sphericalCurvature(vec2 uv, float u0, float u1, float v0, float v1, float r, float convexity) {
    float widthSquared = pow(wMirrorSize.x, 2);
    float heightSquared = pow(wMirrorSize.y, 2);
    return convexity * vec3(
        sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ) 
            - sqrt(pow(r, 2) - widthSquared * pow((u1 - u0) / 2.0, 2) - heightSquared * pow((v1 - v0) / 2.0, 2)),

        widthSquared * ((u0 + u1) / 2.0 - uv.x) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ),

        heightSquared * ((v0 + v1) / 2.0 - uv.y) 
        / sqrt(pow(r, 2) - widthSquared * pow(uv.x - (u1 + u0) / 2.0, 2) - heightSquared * pow(uv.y - (v1 + v0) / 2.0, 2) ) 
    );
}

/*
    Returns height and derivative of height
*/
vec2 smoothStep(float u, float s0, float s1, float h0, float dir) {
    float c = 3; 
    return vec2(
        h0 * (1 - dir) * 0.5 + dir * h0 * 0.5 * (tanh(
                                c * (
                                    2 * (u - s0) / (s1 - s0) - 1.0
                                )
                            ) / tanh(c) + 1.0
                  ),
        dir * h0 * c / (tanh(c) * (s1 - s0)) * (
                    1.0 - pow(
                        tanh(
                            c * (
                                2 * (u - s0) / (s1 - s0) - 1
                            )
                        ), 2
                    )
                )
    );
}


vec2 smoothStepCurvature(vec2 uv, int direction, float s0, float s1, float h0) {
    float c = 3;
    float middle = (s0 + s1) * 0.5;
    if (uv[direction] <= middle) {
        return smoothStep(uv[direction], s0, middle, h0, 1) * vec2(1, 2);
    }
    else {
        return smoothStep(uv[direction], middle, s1, h0, -1) * vec2(1, 2);
    }
}

float e = 2.71828;

vec2 gauss(float t, float s0, float s1, float h) {
    float a = 2.0;
    // f (x) =        h e^(-(2a (x - (s1 - s0) / 2 - s0) / (s1 - s0))^2) - h e^(-a^2)
    // f'(x) = -8 h a^2 e^(-(2a (x - (s1 - s0) / 2 - s0) / (s1 - s0))^2) (x - (s1 - s0) / 2 - s0) / (s1 - s0)^2

    return vec2(
        h * exp(-pow(2 * a * (t - (s1 - s0) / 2.0 - s0) / (s1 - s0), 2)) - h * exp(-a * a),
        -8 * h * a * a * exp(-pow(2 * a * (t - (s1 - s0) / 2.0 - s0) / (s1 - s0), 2))
        * (t - (s1 - s0) / 2.0 - s0) / (s1 - s0) / (s1 - s0)
    );
}

vec2 gaussCurvature(vec2 uv, int direction, float s0, float s1, float r) {
    float a = 2.0;
    float h = (s1 - s0) * (s1 - s0) / (8.0 * a * a * r) * carvConvexity;
    return gauss(uv[direction], s0, s1, h);
}


vec3 topSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.x <= _sx1 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth);
         }
         else if (4 == lineMode) {
            res = gaussCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.x >= _sx2 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth);
         }
         else if (4 == lineMode) {
            res = gaussCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.y <= _sy0 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy0, _sy0 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy0, _sy0 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy0, _sy0 + uvLineWidth.y, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 1, _sy0, _sy0 + uvLineWidth.y, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx1 + uvLineWidth.x, _sx2 - uvLineWidth.x, _sy0 + uvLineWidth.y, _sy1,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

vec3 bottomSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.x <= _sx1 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 0, _sx1, _sx1 + uvLineWidth.x, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.x >= _sx2 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.x, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wMirrorDepth);
         }
         else if (4 == lineMode) {
            res = gaussCurvature(uv, 0, _sx2 - uvLineWidth.x, _sx2, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (uv.y >= _sy3 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy3 - uvLineWidth.y, _sy3, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy3 - uvLineWidth.y, _sy3, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy3 - uvLineWidth.y, _sy3, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 1, _sy3 - uvLineWidth.y, _sy3, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx1 + uvLineWidth.x, _sx2 - uvLineWidth.x, _sy2, _sy3 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

vec3 leftSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.y <= _sy1 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.y >= _sy2 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.x <= _sx0 + uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx0, _sx0 + uvLineWidth.x, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx0, _sx0 + uvLineWidth.x, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx0, _sx0 + uvLineWidth.x, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 0, _sx0, _sx0 + uvLineWidth.x, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx0 + uvLineWidth.x, _sx1, _sy1 + uvLineWidth.y, _sy2 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}
vec3 rightSquare(vec2 uv) {
    float addH = 0;
    float dU = 0;
    float dV = 0;
    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;

    if (uv.y <= _sy1 + uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
            res = smoothStep(uv.y, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth, 1);
         }
         else if (1 == lineMode) {
            res = curvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
            res = smoothStepCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wMirrorDepth);
         }
         else if (4 == lineMode) {
            res = gaussCurvature(uv, 1, _sy1, _sy1 + uvLineWidth.y, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.y >= _sy2 - uvLineWidth.y) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.y, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 1, _sy2 - uvLineWidth.y, _sy2, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dV = res.y;
    }
    else if (uv.x >= _sx3 - uvLineWidth.x) {
         vec2 res;
         if (0 == lineMode) {
             res = smoothStep(uv.x, _sx3 - uvLineWidth.x, _sx3, wMirrorDepth, -1);
         }
         else if (1 == lineMode) {
             res = curvature(uv, 0, _sx3 - uvLineWidth.x, _sx3, wCarvRadius, carvConvexity);
         }
         else if (3 == lineMode) {
             res = smoothStepCurvature(uv, 0, _sx3 - uvLineWidth.x, _sx3, wMirrorDepth);
         }
         else if (4 == lineMode) {
             res = gaussCurvature(uv, 0, _sx3 - uvLineWidth.x, _sx3, wCarvRadius);
         }
         else if (2 == lineMode) {
            res = vec2(0, 0);
         }
         addH = res.x;
         dU = res.y;
    }
    else if (0 == lineMode) {
        addH = wMirrorDepth;
    }
    else if (2 == lineMode) {
        vec3 res = sphericalCurvature(uv, _sx2, _sx3 - uvLineWidth.x, _sy1 + uvLineWidth.y, _sy2 - uvLineWidth.y,
            wMirrorBackgroundRadius, wMirrorBackgroundConvexity
        );
        addH = res.x;
        dU = res.y;
        dV = res.z;
    }
    return vec3(addH, dU, dV);
}

/*
    Calculates the normal and the height of the mirror at a given UV coordinate.
*/
vec4 normHeight(vec2 uv) {

    float wHeight = 0;
    float wDU = 0;
    float wDV = 0;

    // Overall curvature
    vec3 overallCurv = sphericalCurvature(uv, 0, 1, 0, 1, wMirrorCurvatureRadius, mirrorConvexity);
    wHeight += overallCurv.x;
    wDU += overallCurv.y;
    wDV += overallCurv.z;
    
    // Cross shape
    if (uv.x >= _sx0 && uv.x <= _sx3) { // horizontally in shape
        if (uv.y >= _sy0 && uv.y <= _sy3) { // vertically in shape
            if (uv.x >= _sx1 && uv.x <= _sx2) { // middle column
                if (uv.y < _sy1) {  // Top square
                    vec3 retVal = topSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;
                }
                else if (uv.y > _sy2) { // Bottom square
                    vec3 retVal = bottomSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;   
                }
                else if (0 == lineMode) { // Middle square
                    wHeight += wMirrorDepth;
                }
                else if (2 == lineMode) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx1, _sx2, _sy1, _sy2,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
            else if (uv.x < _sx1) { // left column
                if (uv.y >= _sy1 && uv.y <= _sy2) { // left square
                    vec3 retVal = leftSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;   
                }
                else if (uv.y < _sy1) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx0, _sx1, _sy0, _sy1,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
                else if (uv.y > _sy2) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx0, _sx1, _sy2, _sy3,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
            else if (uv.x > _sx2) { // right column
                if (uv.y >= _sy1 && uv.y <= _sy2) { // right square
                    vec3 retVal = rightSquare(uv);
                    wHeight += retVal.x;
                    wDU += retVal.y;
                    wDV += retVal.z;
                }
               else if (uv.y < _sy1) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx2, _sx3, _sy0, _sy1,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
                else if (uv.y > _sy2) {
                    vec2 uvLineWidth = wShapeOutlineWidth.xx / wMirrorSize;
                    vec3 res = sphericalCurvature(uv, _sx2, _sx3, _sy2, _sy3,
                        wMirrorBackgroundRadius, wMirrorBackgroundConvexity
                    );
                    wHeight += res.x;
                    wDU += res.y;
                    wDV += res.z;
                }
            }
        }
    }

    // Tangent vectors:
    /*
    wMirrorSize is needed because earlier we parametrized
    the surface function with uv coordiantes of range [0,1]
    */
    vec3 tanU = vec3(wMirrorSize.x, 0, wDU);
    vec3 tanV = vec3(0, wMirrorSize.y, wDV);

    return vec4(normalize(cross(tanU, tanV)), wHeight);
}

/* Function to linearly interpolate between a0 and a1
 * Weight w should be in the range [0.0, 1.0]
 */
float interpolate(float a0, float a1, float w) {
    /* // You may want clamping by inserting:
     * if (0.0 > w) return a0;
     * if (1.0 < w) return a1;
     */
    return (a1 - a0) * w + a0;
    /* // Use this cubic interpolation [[Smoothstep]] instead, for a smooth appearance:
     * return (a1 - a0) * (3.0 - w * 2.0) * w * w + a0;
     *
     * // Use [[Smootherstep]] for an even smoother result with a second derivative equal to zero on boundaries:
     * return (a1 - a0) * ((w * (w * 6.0 - 15.0) + 10.0) * w * w * w) + a0;
     */
}


void main()
{
    NormalHeightOut = normHeight(texCoords);
}