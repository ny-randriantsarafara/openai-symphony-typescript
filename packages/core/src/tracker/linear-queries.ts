/** GraphQL queries for Linear API. */

export const CANDIDATE_ISSUES_QUERY = `
query CandidateIssues($projectSlug: String!, $stateNames: [String!]!, $first: Int!, $after: String) {
  issues(
    filter: {
      project: { slugId: { eq: $projectSlug } }
      state: { name: { in: $stateNames } }
    }
    first: $first
    after: $after
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      identifier
      title
      description
      priority
      state { name }
      labels { nodes { name } }
      branchName
      url
      createdAt
      updatedAt
      inverseRelations(filter: { type: { eq: "blocks" } }) {
        nodes {
          issue {
            id
            identifier
            state { name }
          }
        }
      }
    }
  }
}
`;

export const ISSUE_STATES_BY_IDS_QUERY = `
query IssueStatesByIds($issueIds: [ID!]!) {
  issues(filter: { id: { in: $issueIds } }, first: 100) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      identifier
      title
      description
      priority
      state { name }
      labels { nodes { name } }
      branchName
      url
      createdAt
      updatedAt
      inverseRelations(filter: { type: { eq: "blocks" } }) {
        nodes {
          issue {
            id
            identifier
            state { name }
          }
        }
      }
    }
  }
}
`;

export const ISSUES_BY_STATES_QUERY = `
query IssuesByStates($projectSlug: String!, $stateNames: [String!]!, $first: Int!, $after: String) {
  issues(
    filter: {
      project: { slugId: { eq: $projectSlug } }
      state: { name: { in: $stateNames } }
    }
    first: $first
    after: $after
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      identifier
      title
      description
      priority
      state { name }
      labels { nodes { name } }
      branchName
      url
      createdAt
      updatedAt
      inverseRelations(filter: { type: { eq: "blocks" } }) {
        nodes {
          issue {
            id
            identifier
            state { name }
          }
        }
      }
    }
  }
}
`;
