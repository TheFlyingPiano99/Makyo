#version 460 core

layout (location = 0) out vec4 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gAlbedo;
layout (location = 3) out vec4 gRoughnessMetallicAO;

in VS_OUT {
	vec4 worldPos;
	vec2 texCoords;
	mat3 TBN;		// Tangent-Bitangent-Normal matrix
} fs_in;

layout (binding = 0) uniform sampler2D albedoMap;


void main()
{
	vec4 color = texture(albedoMap, fs_in.texCoords);
	if (color.a < 0.001) {
		discard;
	}

	gPosition				= fs_in.worldPos / fs_in.worldPos.w;
	gNormal					= vec4(normalize(fs_in.TBN * vec3(0.0, 0.0, 1.0)), 0.0);
	gAlbedo					= vec4(color.rgb, 0.0);	// w == 0 tells that the material should not be shaded
	gRoughnessMetallicAO	= vec4(0.0);
}