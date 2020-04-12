class Node {
  constructor(data, next = null) {
    this.data = data;
    this.next = next;
  }
}

class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  add(data) {
    let newNode = new Node(data);
    if(this.head == null) {
      this.head = newNode;
    } else {
      this.tail.next = newNode;
    }
    this.tail = newNode;
    this.size++;
    return this.head;
  }

  iterate() {
    let dataArr = [];
    let curr = this.head;
    while(curr != null) {
      // console.log(curr.data);
      dataArr.push({"link": curr.data});
      curr = curr.next;
    }
    return dataArr;
  }

}


const path = require(`path`);
const { GraphQLBoolean } = require("gatsby/graphql");
const axios = require('axios');

exports.setFieldsOnGraphQLNodeType = ({ type }) => {
  // if the node is a markdown file, add the `published` field
  if ("MarkdownRemark" === type.name) {
    return {
      published: {
        type: GraphQLBoolean,
        resolve: ({ frontmatter }) => {
          /*
          `published` is always true in development
              so both drafts and finished posts are built
          */
          if (process.env.NODE_ENV !== "production") {
            return true
          }
          /*
          return the opposite of the `draft` value,
          i.e. if draft = true : published = false
          */
          return !frontmatter.draft
        },
      },
    }
  }
  return {}
}

exports.onCreateNode = ({
  node,
  actions,
  createNodeId,
  createContentDigest,
}) => {
  const { createNode, createNodeField, createParentChildLink } = actions

  // Check for the correct type to only affect this
  if (node.internal.type === `PagesJson`) {
    // transform markdown in blocks[i].content
    if (node.blocks) {
      const markdownHost = {
        id: createNodeId(`${node.id} markdown host`),
        parent: node.id,
        internal: {
          contentDigest: createContentDigest(JSON.stringify(node.blocks)),
          type: `${node.internal.type}MarkdownData`,
        },
      }

      createNode(markdownHost)

      createNodeField({
        node,
        name: `markdownContent___NODE`, // Before the ___NODE: Name of the new fields
        value: markdownHost.id, // Connects both nodes
      })

      node.blocks.forEach((block, i) => {
        if (!block.content) {
          block.content = ""
        }
        const blockNode = {
          id: `${node.id} block ${i} markdown`,
          parent: markdownHost.id,
          internal: {
            content: block.content,
            contentDigest: createContentDigest(block.content),
            type: `${node.internal.type}BlockMarkdown`,
            mediaType: "text/markdown",
          },
        }

        createNode(blockNode)

        createParentChildLink({ parent: node, child: blockNode })
      })
    }

    // transform markdown in node.content
    if (node.content) {
      const textNode = {
        id: createNodeId(`${node.id} markdown field`),
        children: [],
        parent: node.id,
        internal: {
          content: node.content,
          mediaType: `text/markdown`, // Important!
          contentDigest: createContentDigest(node.content),
          type: `${node.internal.type}Markdown`,
        },
      }

      createNode(textNode)

      // Add link to the new node
      createNodeField({
        node,
        name: `markdownContent___NODE`, // Before the ___NODE: Name of the new fields
        value: textNode.id, // Connects both nodes
      })
    }
  }
}

exports.createPages = async ({ actions, graphql, reporter }) => {
  const { createPage } = actions

  const result = await graphql(`
    {
      pages: allPagesJson(
        filter: { path: { ne: null }, listType: { eq: null } }
      ) {
        edges {
          node {
            path
          }
        }
      }
      lists: allPagesJson(
        filter: { path: { ne: null }, listType: { ne: null } }
      ) {
        edges {
          node {
            path
            listType
          }
        }
      }
      posts: allMarkdownRemark(
        filter: { frontmatter: { path: { ne: null } } }
      ) {
        edges {
          node {
            published
            frontmatter {
              path
              type
            }
          }
        }
      }
    }
  `)
  let list = new LinkedList();

  if (result.errors) {
    reporter.panicOnBuild(`Error while running GraphQL query.`)
    return
  }

  result.data.pages.edges.forEach(({ node }) => {
    list.add(node.path);
    createPage({
      path: node.path,
      component: path.resolve(`src/templates/page.js`),
      context: {},
    })
  })

  result.data.posts.edges.forEach(({ node }) => {
    if (!node.published) return
    list.add(node.frontmatter.path);
    createPage({
      path: node.frontmatter.path,
      component: path.resolve(`src/templates/post.js`),
      context: {},
    })
  })

  result.data.lists.edges.forEach(({ node }) => {
    list.add(node.path);
    const listPageTemplate = path.resolve(`src/templates/list.js`)
    const listType = node.listType
    const allPosts = result.data.posts.edges
    const posts = allPosts.filter(post => post.type === listType)
    const postsPerPage = 5
    const numPages = Math.max(Math.ceil(posts.length / postsPerPage), 1)
    const slug = node.path

    Array.from({ length: numPages }).forEach((_, i) => {
      const currentPage = i + 1
      const isFirstPage = i === 0

      createPage({
        path: isFirstPage
          ? node.path
          : `${String(node.path)}/${String(currentPage)}`,
        component: listPageTemplate,
        context: {
          listType: listType,
          slug: slug,
          limit: postsPerPage,
          skip: i * postsPerPage,
          numPages: numPages,
          currentPage: currentPage,
        },
      })
    });
  });
  let linkArr = list.iterate();
  console.log(linkArr);
  axios.post
}
