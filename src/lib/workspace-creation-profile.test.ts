import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateUniqueWorkspaceName,
  buildWorkspaceNameFromProfile,
  previewWorkspaceName,
  workspaceCreationProfileDetailRows,
  WORKSPACE_NAME_EXAMPLES,
} from "./workspace-creation-profile";

describe("buildWorkspaceNameFromProfile", () => {
  it("abbreviates corporation or government from region, school, and class", () => {
    assert.equal(
      buildWorkspaceNameFromProfile({
        kind: "corporation_government",
        region: "Caribbean",
        educationLevel: "secondary",
        schoolName: "Kingston High School",
        department: "Science",
        className: "Form 4B",
      }),
      WORKSPACE_NAME_EXAMPLES.corporation_government.name,
    );
  });

  it("abbreviates education institution from school, department, and class", () => {
    assert.equal(
      buildWorkspaceNameFromProfile({
        kind: "education_institution",
        educationLevel: "secondary",
        schoolName: "Kingston High School",
        department: "Science",
        className: "Form 4B",
      }),
      WORKSPACE_NAME_EXAMPLES.education_institution.name,
    );
  });

  it("abbreviates teacher or tutor from school and class", () => {
    assert.equal(
      buildWorkspaceNameFromProfile({
        kind: "teacher_tutor",
        educationLevel: "secondary",
        schoolName: "Kingston High School",
        className: "Form 4B",
      }),
      WORKSPACE_NAME_EXAMPLES.teacher_tutor.name,
    );
  });

  it("abbreviates parent or guardian from child name and class", () => {
    assert.equal(
      buildWorkspaceNameFromProfile({
        kind: "parent_guardian",
        educationLevel: "primary",
        schoolOrChildName: "Maya Thompson",
        className: "Grade 6",
      }),
      WORKSPACE_NAME_EXAMPLES.parent_guardian.name,
    );
  });

  it("abbreviates student or study group from level and class", () => {
    assert.equal(
      buildWorkspaceNameFromProfile({
        kind: "student_study_group",
        educationLevel: "secondary",
        className: "Form 4B",
      }),
      WORKSPACE_NAME_EXAMPLES.student_study_group.name,
    );
  });
});

describe("allocateUniqueWorkspaceName", () => {
  it("keeps the base name when it is free", () => {
    assert.equal(allocateUniqueWorkspaceName("KHS-F4B", ["Sci-Club"]), "KHS-F4B");
  });

  it("appends -2 when the base name is taken", () => {
    assert.equal(
      allocateUniqueWorkspaceName("KHS-F4B", ["khs-f4b"]),
      "KHS-F4B-2",
    );
  });
});

describe("previewWorkspaceName", () => {
  it("is empty until required fields are filled", () => {
    assert.equal(
      previewWorkspaceName({
        kind: "teacher_tutor",
        region: "",
        educationLevel: "secondary",
        schoolName: "Kingston High School",
        schoolOrChildName: "",
        department: "",
        className: "",
      }),
      "",
    );
  });
});

describe("workspaceCreationProfileDetailRows", () => {
  it("lists corporation fields including region and department", () => {
    const rows = workspaceCreationProfileDetailRows({
      kind: "corporation_government",
      region: "Caribbean",
      educationLevel: "secondary",
      schoolName: "Kingston High School",
      department: "Science",
      className: "Form 4B",
    });
    assert.equal(
      rows.find((row) => row.label === "Workspace for")?.value,
      "Corporation or Government",
    );
    assert.equal(
      rows.find((row) => row.label === "Region of institution")?.value,
      "Caribbean",
    );
  });
});
